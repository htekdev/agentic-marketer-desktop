// IPC Channel definitions
export const IPC_CHANNELS = {
  // Agent communication (legacy - keeping for compatibility)
  AGENT_MESSAGE: 'agent:message',
  AGENT_EVENT: 'agent:event',  // Real-time streaming events
  AGENT_STATUS: 'agent:status',
  AGENT_ERROR: 'agent:error',
  AGENT_ASK_USER: 'agent:ask-user',  // Agent needs user input (legacy)
  AGENT_USER_RESPONSE: 'agent:user-response',  // User responds to agent (legacy)
  
  // Workflow events (new state machine pattern)
  WORKFLOW_EVENT: 'workflow:event',  // Phase changes, completion, errors
  WORKFLOW_PENDING_INPUT: 'workflow:pending-input',  // Needs user input (modal)
  WORKFLOW_USER_RESPONSE: 'workflow:user-response',  // User responded to modal
  
  // User actions
  USER_MESSAGE: 'user:message',
  USER_EDIT_PANEL: 'user:edit-panel',
  
  // Panel updates
  PANEL_UPDATE: 'panel:update',
  
  // Run management
  RUN_CREATE: 'run:create',
  RUN_LOAD: 'run:load',
  RUN_LIST: 'run:list',
  RUN_GET: 'run:get',
  
  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  
  // Orchestration mode
  ORCHESTRATION_GET_MODE: 'orchestration:get-mode',
  ORCHESTRATION_SET_MODE: 'orchestration:set-mode',

  // LinkedIn
  LINKEDIN_CONNECT: 'linkedin:connect',
  LINKEDIN_DISCONNECT: 'linkedin:disconnect',
  LINKEDIN_STATUS: 'linkedin:status',
  LINKEDIN_PUBLISH: 'linkedin:publish',
} as const

export type IPCChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS]
