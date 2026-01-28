import { 
  UserMessagePayload, 
  CreateRunPayload, 
  AgentMessagePayload,
  AgentEvent,
  PanelUpdatePayload,
  RunState,
  Settings,
  AgentQuestion,
  AgentReviewRequest,
  AgentUserResponse
} from '../../shared/types'
import {
  WorkflowEvent,
  PendingInput,
  UserInputResponse
} from '../../shared/workflow-types'

type OrchestrationMode = 'pipeline' | 'single-agent' | 'supervisor'

interface LinkedInStatus {
  connected: boolean
  userName: string | null
  configured: boolean
}

interface LinkedInPublishPayload {
  text: string
  imageUrl?: string
}

interface LinkedInPublishResult {
  success: boolean
  postUrn?: string
  error?: string
}

interface WorkflowPendingInputPayload {
  runId: string
  phase: string
  pendingInput: PendingInput
}

interface ApiKeyStatus {
  openaiApiKey: boolean
  exaApiKey: boolean
  linkedinClientId: boolean
  linkedinClientSecret: boolean
}

interface ApiKeysMasked {
  openaiApiKey: string | null
  exaApiKey: string | null
  linkedinClientId: string | null
  linkedinClientSecret: string | null
}

interface CopilotStatus {
  available: boolean
  error?: string
}

declare global {
  interface Window {
    electron: {
      invoke: {
        createRun: (payload: CreateRunPayload) => Promise<RunState>
        getRun: (runId: string) => Promise<RunState | null>
        listRuns: () => Promise<RunState[]>
        sendMessage: (payload: UserMessagePayload) => Promise<{ success: boolean }>
        editPanel: (payload: PanelUpdatePayload) => Promise<{ success: boolean }>
        getSettings: () => Promise<Settings>
        setSettings: (settings: Partial<Settings>) => Promise<{ success: boolean }>
        // Orchestration mode
        getOrchestrationMode: () => Promise<{ mode: OrchestrationMode }>
        setOrchestrationMode: (mode: OrchestrationMode) => Promise<{ success: boolean; mode: OrchestrationMode }>
        // LinkedIn
        linkedInStatus: () => Promise<LinkedInStatus>
        linkedInConnect: () => Promise<{ success: boolean; error?: string }>
        linkedInDisconnect: () => Promise<{ success: boolean }>
        linkedInPublish: (payload: LinkedInPublishPayload) => Promise<LinkedInPublishResult>
        // API Keys
        getApiKeyStatus: () => Promise<ApiKeyStatus>
        getApiKeys: () => Promise<ApiKeysMasked>
        setApiKeys: (keys: { openaiApiKey?: string; exaApiKey?: string; linkedinClientId?: string; linkedinClientSecret?: string }) => Promise<{ success: boolean }>
        validateApiKey: (key: 'openai' | 'exa', value: string) => Promise<{ valid: boolean; error?: string }>
        // Copilot status
        getCopilotStatus: () => Promise<CopilotStatus>
        // Workflow user response (new state machine)
        respondToWorkflow: (runId: string, response: UserInputResponse) => Promise<{ success: boolean }>
        // Legacy agent user response
        respondToAgent: (payload: AgentUserResponse) => Promise<{ success: boolean }>
      }
      on: {
        agentMessage: (callback: (payload: AgentMessagePayload) => void) => () => void
        agentEvent: (callback: (event: AgentEvent) => void) => () => void
        agentError: (callback: (payload: { runId: string; error: string }) => void) => () => void
        panelUpdate: (callback: (payload: PanelUpdatePayload) => void) => () => void
        // Workflow events (new state machine)
        workflowEvent: (callback: (event: WorkflowEvent) => void) => () => void
        workflowPendingInput: (callback: (payload: WorkflowPendingInputPayload) => void) => () => void
        // Legacy agent ask user
        agentAskUser: (callback: (payload: AgentQuestion | AgentReviewRequest) => void) => () => void
      }
    }
  }
}

export {}
