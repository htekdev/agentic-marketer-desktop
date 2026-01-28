// Orchestrator Factory - Creates the appropriate orchestrator based on mode

import { BrowserWindow } from 'electron'
import type { IWorkflowOrchestrator, OrchestrationMode } from './interface'
import { PipelineOrchestrator } from './pipeline/orchestrator'
import { SingleAgentOrchestrator } from './single-agent/orchestrator'

// Re-export types
export type { IWorkflowOrchestrator, OrchestrationMode }

// Default mode - can be changed via settings
let currentMode: OrchestrationMode = 'pipeline'

export function setOrchestrationMode(mode: OrchestrationMode): void {
  currentMode = mode
  console.log(`[orchestration] Mode set to: ${mode}`)
}

export function getOrchestrationMode(): OrchestrationMode {
  return currentMode
}

export function createOrchestrator(mainWindow: BrowserWindow): IWorkflowOrchestrator {
  console.log(`[orchestration] Creating orchestrator with mode: ${currentMode}`)
  
  switch (currentMode) {
    case 'pipeline':
      return new PipelineOrchestrator(mainWindow)
    
    case 'single-agent':
      return new SingleAgentOrchestrator(mainWindow)
    
    case 'supervisor':
      // TODO: Implement supervisor orchestrator
      console.warn('[orchestration] Supervisor mode not yet implemented, falling back to pipeline')
      return new PipelineOrchestrator(mainWindow)
    
    default:
      console.warn(`[orchestration] Unknown mode ${currentMode}, falling back to pipeline`)
      return new PipelineOrchestrator(mainWindow)
  }
}

// Re-export orchestrator classes
export { PipelineOrchestrator } from './pipeline/orchestrator'
export { SingleAgentOrchestrator } from './single-agent/orchestrator'
