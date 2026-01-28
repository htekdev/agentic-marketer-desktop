import { ipcMain, BrowserWindow, app } from 'electron'
import { IPC_CHANNELS } from '../../shared/channels'
import { 
  UserMessagePayload, 
  CreateRunPayload, 
  RunState,
  AgentId,
  AgentUserResponse
} from '../../shared/types'
import { UserInputResponse } from '../../shared/workflow-types'
import { createRun, getRun, listRuns, updateRun } from '../storage/runs'
import { createOrchestrator, IWorkflowOrchestrator, setOrchestrationMode, getOrchestrationMode, OrchestrationMode } from '../orchestration'
import { LinkedInService, LinkedInCredentials } from '../services/linkedin'
import * as fs from 'fs'
import * as path from 'path'

let orchestrator: IWorkflowOrchestrator | null = null
let linkedInService: LinkedInService | null = null

// Settings storage path
const getSettingsPath = () => {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'settings.json')
}

// Load settings from disk
const loadSettings = (): { orchestrationMode?: OrchestrationMode } => {
  try {
    const settingsPath = getSettingsPath()
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf-8')
      return JSON.parse(data)
    }
  } catch (err) {
    console.error('Failed to load settings:', err)
  }
  return {}
}

// Save settings to disk
const saveSettings = (settings: { orchestrationMode?: OrchestrationMode }) => {
  try {
    const settingsPath = getSettingsPath()
    const existing = loadSettings()
    fs.writeFileSync(settingsPath, JSON.stringify({ ...existing, ...settings }, null, 2))
  } catch (err) {
    console.error('Failed to save settings:', err)
  }
}

// LinkedIn credentials storage path
const getLinkedInCredentialsPath = () => {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'linkedin-credentials.json')
}

// Load LinkedIn credentials from disk
const loadLinkedInCredentials = (): LinkedInCredentials | null => {
  try {
    const credPath = getLinkedInCredentialsPath()
    if (fs.existsSync(credPath)) {
      const data = fs.readFileSync(credPath, 'utf-8')
      return JSON.parse(data)
    }
  } catch (err) {
    console.error('Failed to load LinkedIn credentials:', err)
  }
  return null
}

// Save LinkedIn credentials to disk
const saveLinkedInCredentials = (credentials: LinkedInCredentials | null) => {
  try {
    const credPath = getLinkedInCredentialsPath()
    if (credentials) {
      fs.writeFileSync(credPath, JSON.stringify(credentials, null, 2))
    } else if (fs.existsSync(credPath)) {
      fs.unlinkSync(credPath)
    }
  } catch (err) {
    console.error('Failed to save LinkedIn credentials:', err)
  }
}

export function setupIpcHandlers(mainWindow: BrowserWindow): void {
  // Load saved settings and set orchestration mode
  const savedSettings = loadSettings()
  if (savedSettings.orchestrationMode) {
    setOrchestrationMode(savedSettings.orchestrationMode)
    console.log(`[handlers] Loaded saved orchestration mode: ${savedSettings.orchestrationMode}`)
  }

  // Initialize Workflow Orchestrator (uses factory based on mode)
  orchestrator = createOrchestrator(mainWindow)
  
  // Initialize LinkedIn service
  linkedInService = new LinkedInService(mainWindow)
  
  // Configure LinkedIn if env vars are set
  const linkedInClientId = process.env.LINKEDIN_CLIENT_ID
  const linkedInClientSecret = process.env.LINKEDIN_CLIENT_SECRET
  if (linkedInClientId && linkedInClientSecret) {
    linkedInService.configure({
      clientId: linkedInClientId,
      clientSecret: linkedInClientSecret
    })
    
    // Restore saved credentials
    const savedCredentials = loadLinkedInCredentials()
    if (savedCredentials) {
      linkedInService.setCredentials(savedCredentials)
      console.log('[linkedin] Restored credentials for:', savedCredentials.userName)
    }
  } else {
    console.log('[linkedin] Not configured - set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET')
  }
  
  // Initialize the orchestrator asynchronously
  orchestrator.initialize().catch(err => {
    console.error('Failed to initialize Workflow Orchestrator:', err)
  })

  // Clean up on app quit
  app.on('before-quit', async () => {
    if (orchestrator) {
      await orchestrator.destroy()
    }
  })

  // Run management
  ipcMain.handle(IPC_CHANNELS.RUN_CREATE, async (_event, payload: CreateRunPayload) => {
    const run = await createRun(payload.topic)
    return run
  })

  ipcMain.handle(IPC_CHANNELS.RUN_GET, async (_event, runId: string) => {
    return getRun(runId)
  })

  ipcMain.handle(IPC_CHANNELS.RUN_LIST, async () => {
    return listRuns()
  })

  // User messages - now starts workflow instead of single message processing
  ipcMain.handle(IPC_CHANNELS.USER_MESSAGE, async (_event, payload: UserMessagePayload) => {
    const { runId, content } = payload
    
    // Get the run
    const run = await getRun(runId)
    if (!run) {
      throw new Error(`Run ${runId} not found`)
    }

    // Add user message to run
    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content,
      timestamp: new Date().toISOString()
    }
    
    run.messages.push(userMessage)
    await updateRun(run)

    // Start workflow with the new state machine
    // The orchestrator will emit events as each phase completes
    orchestrator?.startWorkflow(runId, content).catch(err => {
      console.error('[handlers] Workflow error:', err)
    })
    
    return { success: true }
  })

  // Workflow user response (when user answers a modal)
  ipcMain.handle(IPC_CHANNELS.WORKFLOW_USER_RESPONSE, async (_event, payload: {
    runId: string
    response: UserInputResponse
  }) => {
    const { runId, response } = payload
    
    // Forward to orchestrator to continue workflow
    orchestrator?.handleUserResponse(runId, response)
    
    return { success: true }
  })

  // Legacy agent response handler (keep for compatibility)
  ipcMain.handle(IPC_CHANNELS.AGENT_USER_RESPONSE, async (_event, payload: AgentUserResponse) => {
    const { runId, answer, selectedIds } = payload
    
    // Convert to new format and forward
    const response: UserInputResponse = selectedIds 
      ? { type: 'findings', selectedIds }  // or 'improvements' - we determine from state
      : { type: 'questions', answers: { question: answer || '' } }
    
    orchestrator?.handleUserResponse(runId, response)
    
    return { success: true }
  })

  // Settings
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => {
    return {
      linkedInConnected: linkedInService?.isConnected() || false,
      linkedInUser: linkedInService?.getCredentials()?.userName || null
    }
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_event, settings) => {
    // TODO: Implement settings storage
    return { success: true }
  })

  // Orchestration mode handlers
  ipcMain.handle(IPC_CHANNELS.ORCHESTRATION_GET_MODE, async () => {
    return { mode: getOrchestrationMode() }
  })

  ipcMain.handle(IPC_CHANNELS.ORCHESTRATION_SET_MODE, async (_event, payload: { mode: OrchestrationMode }) => {
    const { mode } = payload
    console.log(`[handlers] Switching orchestration mode to: ${mode}`)
    
    // Destroy current orchestrator
    if (orchestrator) {
      await orchestrator.destroy()
    }
    
    // Set new mode and create new orchestrator
    setOrchestrationMode(mode)
    orchestrator = createOrchestrator(mainWindow)
    await orchestrator.initialize()
    
    // Persist to disk
    saveSettings({ orchestrationMode: mode })
    
    return { success: true, mode }
  })

  // LinkedIn handlers
  ipcMain.handle(IPC_CHANNELS.LINKEDIN_STATUS, async () => {
    const credentials = linkedInService?.getCredentials()
    return {
      connected: linkedInService?.isConnected() || false,
      userName: credentials?.userName || null,
      profilePicture: credentials?.profilePicture || null,
      configured: !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET)
    }
  })

  ipcMain.handle(IPC_CHANNELS.LINKEDIN_CONNECT, async () => {
    if (!linkedInService) {
      throw new Error('LinkedIn service not initialized')
    }
    
    try {
      const credentials = await linkedInService.startOAuthFlow()
      saveLinkedInCredentials(credentials)
      return { success: true, userName: credentials.userName }
    } catch (err) {
      console.error('[linkedin] OAuth failed:', err)
      throw err
    }
  })

  ipcMain.handle(IPC_CHANNELS.LINKEDIN_DISCONNECT, async () => {
    if (linkedInService) {
      linkedInService.disconnect()
      saveLinkedInCredentials(null)
    }
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.LINKEDIN_PUBLISH, async (_event, payload: { 
    text: string
    imageUrl?: string 
  }) => {
    if (!linkedInService) {
      return { success: false, error: 'LinkedIn service not initialized' }
    }

    if (!linkedInService.isConnected()) {
      return { success: false, error: 'Not connected to LinkedIn' }
    }

    if (payload.imageUrl) {
      return linkedInService.publishPostWithImage(payload.text, payload.imageUrl)
    } else {
      return linkedInService.publishTextPost(payload.text)
    }
  })
}
