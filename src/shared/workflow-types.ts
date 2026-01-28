// Workflow State Machine Types

import type { AgentId, ResearchData, PositioningData, DraftData, Message } from './types'

// All possible workflow phases
export type WorkflowPhase =
  | 'idle'
  | 'planner'
  | 'planner_waiting'      // Waiting for user to answer questions
  | 'research'
  | 'research_waiting'     // Waiting for user to select findings
  | 'positioning'
  | 'draft'
  | 'critic'
  | 'critic_waiting'       // Waiting for user to approve improvements
  | 'image'
  | 'complete'
  | 'error'

// Clarifying question from planner
export interface ClarifyingQuestion {
  id: string
  question: string
  options?: string[]  // Suggested answers (optional)
}

// Research finding for user selection
export interface ResearchFinding {
  id: string
  title: string
  summary: string
  source?: string
  url?: string
}

// Improvement suggestion from critic
export interface ImprovementSuggestion {
  id: string
  category: 'hook' | 'body' | 'credibility' | 'cta' | 'tone' | 'structure'
  description: string
  currentText?: string
  suggestedText?: string
  impact: 'high' | 'medium' | 'low'
}

// Content plan from planner
export interface ContentPlan {
  topic: string
  angle: string
  targetAudience: string
  keyPoints: string[]
  tone: string
  includeStats: boolean
  includeStory: boolean
}

// Pending input variants - what the UI needs to show
export type PendingInput =
  | {
      type: 'questions'
      questions: ClarifyingQuestion[]
    }
  | {
      type: 'findings'
      findings: ResearchFinding[]
      summary: string
    }
  | {
      type: 'improvements'
      improvements: ImprovementSuggestion[]
      currentDraft: string
    }

// The main workflow state - passed between phases
export interface WorkflowState {
  runId: string
  phase: WorkflowPhase
  userRequest: string

  // Pending user input (null = no input needed, auto-continue)
  pendingInput: PendingInput | null

  // Data accumulated from each phase
  plannerAnswers?: Record<string, string>
  plan?: ContentPlan
  visualDirection?: string  // Guidance for image generation from planner
  
  // Phase control flags (from planner)
  skipResearch?: boolean  // Skip research phase
  skipPositioning?: boolean  // Skip positioning phase
  skipCritic?: boolean  // Skip critic phase
  skipImage?: boolean  // Skip image generation
  draftInstructions?: string  // Specific instructions for draft phase
  
  researchFindings?: ResearchFinding[]
  selectedFindingIds?: string[]
  research?: ResearchData
  
  positioning?: PositioningData
  
  draft?: string
  
  improvements?: ImprovementSuggestion[]
  approvedImprovementIds?: string[]
  finalDraft?: string
  
  imageUrl?: string
  imagePrompt?: string

  // For UI display
  error?: string
  messages: Message[]
}

// User response to pending input
export interface UserInputResponse {
  type: 'questions' | 'findings' | 'improvements'
  // For questions: { [questionId]: answer }
  answers?: Record<string, string>
  // For findings/improvements: selected IDs
  selectedIds?: string[]
}

// Phase result - what a phase handler returns
export interface PhaseResult {
  // Updated state
  state: WorkflowState
  // Whether to auto-continue to next phase (false if pendingInput is set)
  continue: boolean
}

// Events emitted by the orchestrator
export type WorkflowEventType =
  | 'phase_start'
  | 'phase_complete'
  | 'pending_input'
  | 'state_update'
  | 'workflow_complete'
  | 'workflow_error'

export interface WorkflowEvent {
  type: WorkflowEventType
  runId: string
  phase: WorkflowPhase
  state: WorkflowState
  timestamp: string
}

// Phase handler function signature
export type PhaseHandler = (state: WorkflowState) => Promise<PhaseResult>

// Initial state factory
export function createInitialState(runId: string, userRequest: string): WorkflowState {
  return {
    runId,
    phase: 'planner',
    userRequest,
    pendingInput: null,
    messages: []
  }
}

// Helper to add a message to state
export function addMessage(
  state: WorkflowState,
  role: 'user' | 'agent',
  content: string,
  agentId?: AgentId
): WorkflowState {
  return {
    ...state,
    messages: [
      ...state.messages,
      {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role,
        content,
        agentId,
        timestamp: new Date().toISOString()
      }
    ]
  }
}
