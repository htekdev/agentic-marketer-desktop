// Orchestrator Interface - All orchestration patterns implement this

import { WorkflowState, UserInputResponse } from '../../shared/workflow-types'

export type OrchestrationMode = 'pipeline' | 'single-agent' | 'supervisor'

export interface IWorkflowOrchestrator {
  /**
   * Initialize the orchestrator (start SDK client, etc.)
   */
  initialize(): Promise<void>

  /**
   * Start a new workflow for a user request
   */
  startWorkflow(runId: string, userRequest: string): Promise<void>

  /**
   * Handle user response to pending input (questions, confirmations)
   */
  handleUserResponse(runId: string, response: UserInputResponse): Promise<void>

  /**
   * Handle follow-up message on completed workflow
   */
  handleFollowUp(runId: string, userRequest: string): Promise<void>

  /**
   * Get current state for a workflow
   */
  getState(runId: string): WorkflowState | undefined

  /**
   * Check if a workflow exists and is complete
   */
  isWorkflowComplete(runId: string): boolean

  /**
   * Clean up resources
   */
  destroy(): Promise<void>
}
