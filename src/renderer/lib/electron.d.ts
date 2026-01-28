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
