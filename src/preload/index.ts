import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/channels'
import type { 
  UserMessagePayload, 
  CreateRunPayload,
  AgentMessagePayload,
  AgentEvent,
  PanelUpdatePayload,
  AgentQuestion,
  AgentReviewRequest,
  AgentUserResponse
} from '../shared/types'
import type {
  WorkflowEvent,
  PendingInput,
  UserInputResponse
} from '../shared/workflow-types'

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // Invoke methods (request-response pattern)
  invoke: {
    createRun: (payload: CreateRunPayload) => 
      ipcRenderer.invoke(IPC_CHANNELS.RUN_CREATE, payload),
    
    getRun: (runId: string) => 
      ipcRenderer.invoke(IPC_CHANNELS.RUN_GET, runId),
    
    listRuns: () => 
      ipcRenderer.invoke(IPC_CHANNELS.RUN_LIST),
    
    sendMessage: (payload: UserMessagePayload) => 
      ipcRenderer.invoke(IPC_CHANNELS.USER_MESSAGE, payload),
    
    editPanel: (payload: PanelUpdatePayload) => 
      ipcRenderer.invoke(IPC_CHANNELS.USER_EDIT_PANEL, payload),
    
    getSettings: () => 
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
    
    setSettings: (settings: Record<string, unknown>) => 
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, settings),

    // Orchestration mode
    getOrchestrationMode: () =>
      ipcRenderer.invoke(IPC_CHANNELS.ORCHESTRATION_GET_MODE),
    
    setOrchestrationMode: (mode: 'pipeline' | 'single-agent' | 'supervisor') =>
      ipcRenderer.invoke(IPC_CHANNELS.ORCHESTRATION_SET_MODE, { mode }),

    // LinkedIn
    linkedInStatus: () =>
      ipcRenderer.invoke(IPC_CHANNELS.LINKEDIN_STATUS),
    
    linkedInConnect: () =>
      ipcRenderer.invoke(IPC_CHANNELS.LINKEDIN_CONNECT),
    
    linkedInDisconnect: () =>
      ipcRenderer.invoke(IPC_CHANNELS.LINKEDIN_DISCONNECT),
    
    linkedInPublish: (payload: { text: string; imageUrl?: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.LINKEDIN_PUBLISH, payload),

    // Workflow user response (new state machine pattern)
    respondToWorkflow: (runId: string, response: UserInputResponse) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKFLOW_USER_RESPONSE, { runId, response }),

    // Legacy agent user response (kept for compatibility)
    respondToAgent: (payload: AgentUserResponse) =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_USER_RESPONSE, payload),
  },

  // Subscribe to events (server-push pattern)
  on: {
    agentMessage: (callback: (payload: AgentMessagePayload) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: AgentMessagePayload) => {
        callback(payload)
      }
      ipcRenderer.on(IPC_CHANNELS.AGENT_MESSAGE, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.AGENT_MESSAGE, listener)
    },

    agentEvent: (callback: (event: AgentEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: AgentEvent) => {
        callback(payload)
      }
      ipcRenderer.on(IPC_CHANNELS.AGENT_EVENT, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.AGENT_EVENT, listener)
    },

    agentError: (callback: (payload: { runId: string; error: string }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: { runId: string; error: string }) => {
        callback(payload)
      }
      ipcRenderer.on(IPC_CHANNELS.AGENT_ERROR, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.AGENT_ERROR, listener)
    },

    panelUpdate: (callback: (payload: PanelUpdatePayload) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: PanelUpdatePayload) => {
        callback(payload)
      }
      ipcRenderer.on(IPC_CHANNELS.PANEL_UPDATE, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.PANEL_UPDATE, listener)
    },

    // New workflow events (state machine pattern)
    workflowEvent: (callback: (event: WorkflowEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: WorkflowEvent) => {
        callback(payload)
      }
      ipcRenderer.on(IPC_CHANNELS.WORKFLOW_EVENT, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.WORKFLOW_EVENT, listener)
    },

    workflowPendingInput: (callback: (payload: { runId: string; phase: string; pendingInput: PendingInput }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: { runId: string; phase: string; pendingInput: PendingInput }) => {
        callback(payload)
      }
      ipcRenderer.on(IPC_CHANNELS.WORKFLOW_PENDING_INPUT, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.WORKFLOW_PENDING_INPUT, listener)
    },

    // Legacy agent ask user (kept for compatibility)
    agentAskUser: (callback: (payload: AgentQuestion | AgentReviewRequest) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: AgentQuestion | AgentReviewRequest) => {
        callback(payload)
      }
      ipcRenderer.on(IPC_CHANNELS.AGENT_ASK_USER, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.AGENT_ASK_USER, listener)
    },
  }
})
