// Critic Phase - Reviews and AUTOMATICALLY improves the draft
// No user confirmation - trusts the agent to make good edits

import { CopilotClient, defineTool } from '@github/copilot-sdk'
import { BrowserWindow } from 'electron'
import { z } from 'zod'
import { WorkflowState, addMessage } from '../../../../shared/workflow-types'
import { AgentEvent } from '../../../../shared/types'
import { IPC_CHANNELS } from '../../../../shared/channels'

const CRITIC_PROMPT = `You are an editor improving LinkedIn posts.

## YOUR ROLE
Review the draft and make it better. Apply improvements directly - don't ask for permission.

## YOUR TOOL
- **submit_improved_draft**: Submit the improved version of the post

## WHAT TO IMPROVE
- Hook: Make the first line stop the scroll
- Clarity: Remove fluff, tighten sentences
- Value: Ensure every line earns its place
- Flow: Smooth transitions between ideas
- CTA: End with something engaging

## WHAT TO PRESERVE
- The author's voice and intent
- Core message and facts
- Overall structure if it works

## GUIDELINES
- Make substantive improvements, not just minor tweaks
- If the draft is already good, make minimal changes
- Keep it natural - don't over-optimize
- Preserve any source links and hashtags`

export async function runCriticPhase(
  client: CopilotClient,
  mainWindow: BrowserWindow,
  state: WorkflowState
): Promise<WorkflowState> {
  console.log('[critic-phase] Starting critic phase')

  // Check if critic should be skipped
  if (state.skipCritic) {
    console.log('[critic-phase] Skipping - draft is final')
    const nextPhase = state.skipImage ? 'complete' : 'image'
    return {
      ...state,
      phase: nextPhase,
      finalDraft: state.draft,
      pendingInput: null,
      messages: addMessage(state, 'agent', `Draft is ready!`, 'critic').messages
    }
  }

  if (!state.draft) {
    return {
      ...state,
      phase: 'error',
      error: 'No draft to review'
    }
  }

  const positioningContext = state.positioning
    ? `Target: ${state.positioning.audience}
Desired tone: ${state.positioning.tone}
Angle: ${state.positioning.angle}`
    : ''

  const prompt = `Review and improve this LinkedIn post:

"""
${state.draft}
"""

${positioningContext ? `Context:\n${positioningContext}` : ''}

Make improvements to strengthen the hook, clarity, and engagement. Then submit the improved version using submit_improved_draft.`

  let improvedDraft = ''

  const sessionId = `${state.runId}-critic-${Date.now()}`
  const session = await client.createSession({
    sessionId,
    model: 'Claude Opus 4.5',
    streaming: true,
    systemMessage: { content: CRITIC_PROMPT },
    tools: [
      defineTool('submit_improved_draft', {
        description: 'Submit the improved version of the post',
        parameters: z.object({
          improvedPost: z.string().describe('The improved LinkedIn post'),
          changesSummary: z.string().describe('Brief summary of what was improved')
        }),
        handler: async ({ improvedPost, changesSummary }) => {
          console.log(`[critic-phase] Received improved draft: ${changesSummary}`)
          improvedDraft = improvedPost
          return { success: true }
        }
      })
    ]
  })

  // Stream events to UI
  session.on((event) => {
    emitAgentEvent(mainWindow, state.runId, 'critic', event)
  })

  try {
    await session.sendAndWait({ prompt }, 90000)
  } catch (error) {
    console.error('[critic-phase] Error:', error)
    // If critic fails, just use original draft
    improvedDraft = state.draft
  } finally {
    await session.destroy()
  }

  // Use improved draft or fall back to original
  const finalDraft = improvedDraft || state.draft

  // Update draft panel
  mainWindow.webContents.send(IPC_CHANNELS.PANEL_UPDATE, {
    runId: state.runId,
    panel: 'draft',
    data: {
      fullText: finalDraft,
      hook: '',
      body: '',
      cta: '',
      characterCount: finalDraft.length
    }
  })

  // Check if we should skip image generation
  const nextPhase = state.skipImage ? 'complete' : 'image'
  const statusMessage = state.skipImage 
    ? `✨ Done! Your updated post is ready.`
    : `Draft polished! Now creating an image...`

  return {
    ...state,
    phase: nextPhase,
    finalDraft,
    pendingInput: null,
    messages: addMessage(state, 'agent', statusMessage, 'critic').messages
  }
}

function emitAgentEvent(
  mainWindow: BrowserWindow,
  runId: string,
  agentId: string,
  event: any
): void {
  if (mainWindow.isDestroyed()) return

  const agentEvent: AgentEvent = {
    type: mapEventType(event.type),
    runId,
    agentId: agentId as any,
    timestamp: new Date().toISOString(),
    data: event.data || {}
  }

  mainWindow.webContents.send(IPC_CHANNELS.AGENT_EVENT, agentEvent)
}

function mapEventType(sdkType: string): AgentEvent['type'] {
  const mapping: Record<string, AgentEvent['type']> = {
    'assistant.turn_start': 'turn_start',
    'assistant.message_delta': 'message_delta',
    'assistant.message': 'message',
    'assistant.reasoning_delta': 'reasoning_delta',
    'assistant.reasoning': 'reasoning',
    'tool.execution_start': 'tool_start',
    'tool.execution_complete': 'tool_complete',
    'assistant.turn_end': 'turn_end'
  }
  return mapping[sdkType] || 'message'
}

