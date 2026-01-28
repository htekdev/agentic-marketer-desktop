// Pipeline Orchestrator - Sequential phase-based workflow
// Each phase runs quickly and returns. No long-running waits for user input.

import { EventEmitter } from 'events'
import { BrowserWindow } from 'electron'
import { CopilotClient } from '@github/copilot-sdk'
import {
  WorkflowState,
  WorkflowEvent,
  UserInputResponse,
  createInitialState
} from '../../../shared/workflow-types'
import { IPC_CHANNELS } from '../../../shared/channels'
import { updateRun } from '../../storage/runs'
import { IWorkflowOrchestrator } from '../interface'

// Phase handlers
import { runPlannerPhase } from './phases/planner-phase'
import { runResearchPhase } from './phases/research-phase'
import { runPositioningPhase } from './phases/positioning-phase'
import { runDraftPhase } from './phases/draft-phase'
import { runCriticPhase } from './phases/critic-phase'
import { runImagePhase } from './phases/image-phase'

export class PipelineOrchestrator extends EventEmitter implements IWorkflowOrchestrator {
  private client: CopilotClient | null = null
  private mainWindow: BrowserWindow
  private workflows: Map<string, WorkflowState> = new Map()

  constructor(mainWindow: BrowserWindow) {
    super()
    this.mainWindow = mainWindow
  }

  async initialize(): Promise<void> {
    if (this.client) return

    this.client = new CopilotClient({
      autoStart: true,
      autoRestart: true,
      logLevel: 'info'
    })

    await this.client.start()
    console.log('[pipeline] Copilot SDK client started')
  }

  async startWorkflow(runId: string, userRequest: string): Promise<void> {
    if (!this.client) {
      await this.initialize()
    }

    const existingState = this.workflows.get(runId)
    
    // If workflow exists and is complete, treat this as a follow-up
    if (existingState && existingState.phase === 'complete') {
      console.log(`[pipeline] Follow-up on completed workflow: ${runId}`)
      await this.handleFollowUp(runId, userRequest)
      return
    }
    
    // If workflow exists and is in progress, ignore duplicate
    if (existingState && existingState.phase !== 'complete' && existingState.phase !== 'error') {
      console.log(`[pipeline] Workflow ${runId} in progress, ignoring duplicate start`)
      return
    }

    console.log(`[pipeline] Starting workflow: ${runId}`)

    // Create initial state
    const state = createInitialState(runId, userRequest)
    state.messages.push({
      id: `msg-${Date.now()}`,
      role: 'user',
      content: userRequest,
      timestamp: new Date().toISOString()
    })

    this.workflows.set(runId, state)
    this.emitEvent('phase_start', state)

    // Start running phases
    await this.runNextPhase(runId)
  }

  async handleFollowUp(runId: string, userRequest: string): Promise<void> {
    const existingState = this.workflows.get(runId)
    if (!existingState) return

    // Add user message
    const newState: WorkflowState = {
      ...existingState,
      phase: 'planner',  // Go back to planner to analyze what's needed
      userRequest: userRequest,  // Update with the new request
      pendingInput: null,
      messages: [
        ...existingState.messages,
        {
          id: `msg-${Date.now()}`,
          role: 'user',
          content: userRequest,
          timestamp: new Date().toISOString()
        }
      ]
    }

    this.workflows.set(runId, newState)
    this.emitEvent('phase_start', newState)

    // Planner will analyze what's needed based on the follow-up
    await this.runNextPhase(runId)
  }

  getState(runId: string): WorkflowState | undefined {
    return this.workflows.get(runId)
  }

  isWorkflowComplete(runId: string): boolean {
    const state = this.workflows.get(runId)
    return state?.phase === 'complete'
  }

  async handleUserResponse(runId: string, response: UserInputResponse): Promise<void> {
    const state = this.workflows.get(runId)
    if (!state || !state.pendingInput) {
      console.error(`[pipeline] No pending input for run ${runId}`)
      return
    }

    console.log(`[pipeline] User responded to ${state.phase}:`, response.type)

    // Update state based on response type
    let newState = { ...state }

    switch (response.type) {
      case 'questions':
        newState.plannerAnswers = response.answers || {}
        newState.pendingInput = null
        newState.phase = 'planner'
        break

      case 'findings':
        newState.selectedFindingIds = response.selectedIds || []
        newState.pendingInput = null
        newState.phase = 'research'
        break

      case 'improvements':
        newState.approvedImprovementIds = response.selectedIds || []
        newState.pendingInput = null
        newState.phase = 'critic'
        break
    }

    this.workflows.set(runId, newState)
    this.emitEvent('state_update', newState)

    // Continue workflow
    await this.runNextPhase(runId)
  }

  private async runNextPhase(runId: string): Promise<void> {
    const state = this.workflows.get(runId)
    if (!state) return

    // If there's pending input, wait for user
    if (state.pendingInput) {
      console.log(`[pipeline] Waiting for user input at phase: ${state.phase}`)
      this.emitPendingInput(state)
      return
    }

    // Handle _waiting phases
    if (state.phase.endsWith('_waiting')) {
      console.log(`[pipeline] Still in waiting phase ${state.phase}, emitting pending input`)
      this.emitPendingInput(state)
      return
    }

    console.log(`[pipeline] Running phase: ${state.phase}`)
    this.emitEvent('phase_start', state)

    try {
      let newState: WorkflowState

      switch (state.phase) {
        case 'planner':
          newState = await runPlannerPhase(this.client!, this.mainWindow, state)
          break

        case 'research':
          newState = await runResearchPhase(this.client!, this.mainWindow, state)
          break

        case 'positioning':
          newState = await runPositioningPhase(this.client!, this.mainWindow, state)
          break

        case 'draft':
          newState = await runDraftPhase(this.client!, this.mainWindow, state)
          break

        case 'critic':
          newState = await runCriticPhase(this.client!, this.mainWindow, state)
          break

        case 'image':
          newState = await runImagePhase(this.client!, this.mainWindow, state)
          break

        case 'complete':
          console.log(`[pipeline] Workflow complete: ${runId}`)
          this.emitEvent('workflow_complete', state)
          return

        case 'error':
          console.log(`[pipeline] Workflow error: ${runId}`)
          this.emitEvent('workflow_error', state)
          return

        default:
          console.log(`[pipeline] Unknown phase: ${state.phase}`)
          return
      }

      // Save new state
      this.workflows.set(runId, newState)
      this.emitEvent('phase_complete', newState)

      // Sync state to run storage for UI panels
      await this.syncToRunStorage(newState)

      // Continue to next phase (or wait for user input)
      await this.runNextPhase(runId)

    } catch (error) {
      console.error(`[pipeline] Phase error:`, error)
      const errorState: WorkflowState = {
        ...state,
        phase: 'error',
        error: error instanceof Error ? error.message : String(error)
      }
      this.workflows.set(runId, errorState)
      this.emitEvent('workflow_error', errorState)
    }
  }

  private async syncToRunStorage(state: WorkflowState): Promise<void> {
    try {
      const updates: any = {}

      if (state.research) {
        updates.research = state.research
      }
      if (state.positioning) {
        updates.positioning = state.positioning
      }
      if (state.finalDraft || state.draft) {
        updates.draft = {
          fullText: state.finalDraft || state.draft || '',
          hook: '',
          body: '',
          cta: '',
          characterCount: (state.finalDraft || state.draft || '').length
        }
      }
      if (state.imageUrl) {
        updates.image = {
          url: state.imageUrl,
          altText: state.imagePrompt || '',
          status: 'ready'
        }
      }

      if (Object.keys(updates).length > 0) {
        await updateRun(state.runId, updates)
      }
    } catch (error) {
      console.error('[pipeline] Failed to sync to run storage:', error)
    }
  }

  private emitEvent(type: WorkflowEvent['type'], state: WorkflowState): void {
    const event: WorkflowEvent = {
      type,
      runId: state.runId,
      phase: state.phase,
      state,
      timestamp: new Date().toISOString()
    }

    this.emit(type, event)

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(IPC_CHANNELS.WORKFLOW_EVENT, event)
    }
  }

  private emitPendingInput(state: WorkflowState): void {
    if (!state.pendingInput) return

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(IPC_CHANNELS.WORKFLOW_PENDING_INPUT, {
        runId: state.runId,
        phase: state.phase,
        pendingInput: state.pendingInput
      })
    }
  }

  async destroy(): Promise<void> {
    this.workflows.clear()
    if (this.client) {
      await this.client.stop()
      this.client = null
    }
    console.log('[pipeline] Shutdown complete')
  }
}
