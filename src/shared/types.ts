// Shared types between main and renderer processes

export type AgentId = 'conductor' | 'planner' | 'research' | 'positioning' | 'draft' | 'critic' | 'image'

export interface Message {
  id: string
  role: 'user' | 'agent'
  content: string
  agentId?: AgentId
  timestamp: string
  isStreaming?: boolean
  toolCalls?: ToolCall[]
}

export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
  result?: string
  status: 'pending' | 'running' | 'completed' | 'error'
}

// Agent event types for real-time streaming
export type AgentEventType = 
  | 'turn_start'
  | 'intent'
  | 'reasoning_delta'
  | 'reasoning'
  | 'message_delta'
  | 'message'
  | 'tool_start'
  | 'tool_progress'
  | 'tool_complete'
  | 'turn_end'
  | 'error'
  | 'idle'

export interface AgentEvent {
  type: AgentEventType
  runId: string
  agentId: AgentId
  timestamp: string
  data: {
    // For message events
    content?: string
    deltaContent?: string
    messageId?: string
    // For reasoning events
    reasoningId?: string
    // For tool events
    toolCallId?: string
    toolName?: string
    toolArgs?: unknown
    toolResult?: string
    toolError?: string
    // For intent events
    intent?: string
    // For error events
    error?: string
    // For turn events
    turnId?: string
  }
}

export interface Source {
  id: string
  url: string
  title: string
  content: string
  addedAt: string
}

export interface ResearchData {
  sources: Source[]
  facts: string[]
  claims: string[]
}

export interface PositioningData {
  angle: string
  audience: string
  painPoints: string[]
  tone: string
}

export interface DraftData {
  hook: string
  body: string
  cta: string
  fullText: string
  characterCount: number
}

export interface ImageData {
  url: string | null
  altText: string
  status: 'pending' | 'generating' | 'ready' | 'error'
}

export interface RunState {
  id: string
  topic: string
  status: 'active' | 'completed' | 'error'
  createdAt: string
  updatedAt: string
  messages: Message[]
  research: ResearchData
  positioning: PositioningData | null
  draft: DraftData | null
  image: ImageData | null
}

export interface PanelUpdate {
  panel: 'research' | 'positioning' | 'draft' | 'image'
  data: Partial<ResearchData | PositioningData | DraftData | ImageData>
}

// IPC message types
export interface UserMessagePayload {
  runId: string
  content: string
  mention?: AgentId
}

export interface AgentMessagePayload {
  runId: string
  agentId: AgentId
  content: string
  isStreaming: boolean
  toolCalls?: ToolCall[]
}

export interface PanelUpdatePayload {
  runId: string
  panel: PanelUpdate['panel']
  data: PanelUpdate['data']
}

export interface CreateRunPayload {
  topic: string
}

// Agent asking user for input
export interface AgentQuestion {
  runId: string
  agentId: string
  question: string
  options: string[]
  allowCustom?: boolean
}

// Critic improvement suggestion
export interface Improvement {
  id: string
  category: 'hook' | 'body' | 'credibility' | 'cta' | 'tone' | 'structure'
  description: string
  currentText?: string
  suggestedText?: string
  impact: 'high' | 'medium' | 'low'
}

export interface AgentReviewRequest {
  runId: string
  agentId: string
  type: 'review_improvements' | 'review_research'
  improvements?: Improvement[]
  researchFindings?: {
    id: string
    title: string
    summary: string
    source?: string
  }[]
}

export interface AgentUserResponse {
  runId: string
  questionId?: string
  answer?: string  // For single questions
  selectedIds?: string[]  // For multi-select (improvements, research)
}

export interface Settings {
  openaiApiKey?: string
  exaApiKey?: string
  brandVoice?: {
    tone: string
    personality: string[]
  }
}
