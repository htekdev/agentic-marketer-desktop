// Positioning Phase - Defines strategic angle, audience, and tone
// No user interaction - runs quickly and moves to draft

import { CopilotClient, defineTool } from '@github/copilot-sdk'
import { BrowserWindow } from 'electron'
import { z } from 'zod'
import { WorkflowState, addMessage } from '../../../../shared/workflow-types'
import { PositioningData, AgentEvent } from '../../../../shared/types'
import { IPC_CHANNELS } from '../../../../shared/channels'

const POSITIONING_PROMPT = `You are a Positioning Strategist for LinkedIn content.

## YOUR ROLE
Define the strategic positioning for maximum impact. You analyze:
- The research findings and data
- The target audience and their pain points
- The content plan and goals

## YOUR TOOL
- **submit_positioning**: Submit the content positioning strategy

## OUTPUT
Create positioning that includes:
- A compelling angle that differentiates from generic content
- Clear audience definition with specific pain points
- Tone guidelines that match the audience and goal

Make the angle SPECIFIC and OPINIONATED - not generic.`

export async function runPositioningPhase(
  client: CopilotClient,
  mainWindow: BrowserWindow,
  state: WorkflowState
): Promise<WorkflowState> {
  console.log('[positioning-phase] Starting positioning phase')

  // Check if positioning should be skipped (reuse existing)
  if (state.skipPositioning && state.positioning) {
    console.log('[positioning-phase] Skipping - reusing existing positioning')
    return {
      ...state,
      phase: 'draft',
      pendingInput: null,
      messages: addMessage(state, 'agent', `Keeping current positioning...`, 'positioning').messages
    }
  }

  // Build context from plan and research
  const planContext = state.plan
    ? `Plan:
- Topic: ${state.plan.topic}
- Target Audience: ${state.plan.targetAudience}
- Angle: ${state.plan.angle}
- Tone: ${state.plan.tone}
- Key Points: ${state.plan.keyPoints.join(', ')}`
    : `Topic: ${state.userRequest}`

  const researchContext = state.research?.facts?.length
    ? `Research Findings:\n${state.research.facts.map((f, i) => `${i + 1}. ${f}`).join('\n')}`
    : 'No specific research data available.'

  const prompt = `Define the content positioning strategy based on:

${planContext}

${researchContext}

Use submit_positioning to provide a clear strategic direction for the LinkedIn post.`

  // Capture positioning result
  let positioning: PositioningData | null = null

  const sessionId = `${state.runId}-positioning-${Date.now()}`
  const session = await client.createSession({
    sessionId,
    model: 'Claude Opus 4.5',
    streaming: true,
    systemMessage: { content: POSITIONING_PROMPT },
    tools: [
      defineTool('submit_positioning', {
        description: 'Submit the content positioning strategy',
        parameters: z.object({
          angle: z.string().describe('The unique, specific angle for this post'),
          audience: z.string().describe('Detailed description of target audience'),
          painPoints: z.array(z.string()).describe('3-5 specific pain points or challenges the audience faces'),
          tone: z.string().describe('Tone of voice (e.g., "confident but approachable", "provocative yet professional")')
        }),
        handler: async (p) => {
          console.log(`[positioning-phase] Received positioning: ${p.angle.substring(0, 50)}...`)
          positioning = p
          return { success: true }
        }
      })
    ]
  })

  // Stream events to UI
  session.on((event) => {
    emitAgentEvent(mainWindow, state.runId, 'positioning', event)
  })

  try {
    await session.sendAndWait({ prompt }, 60000)
  } catch (error) {
    console.error('[positioning-phase] Error:', error)
    throw error
  } finally {
    await session.destroy()
  }

  if (positioning) {
    const pos = positioning as PositioningData  // TypeScript inference helper
    // Emit panel update
    mainWindow.webContents.send(IPC_CHANNELS.PANEL_UPDATE, {
      runId: state.runId,
      panel: 'positioning',
      data: pos
    })

    return {
      ...state,
      phase: 'draft',
      positioning: pos,
      messages: addMessage(state, 'agent', `Positioning defined: "${pos.angle}". Now writing the draft...`, 'positioning').messages
    }
  } else {
    // Create default positioning
    const defaultPositioning: PositioningData = {
      angle: state.plan?.angle || 'Share insights on ' + state.userRequest,
      audience: state.plan?.targetAudience || 'LinkedIn professionals',
      painPoints: state.plan?.keyPoints || ['Need for practical insights'],
      tone: state.plan?.tone || 'Professional but conversational'
    }

    mainWindow.webContents.send(IPC_CHANNELS.PANEL_UPDATE, {
      runId: state.runId,
      panel: 'positioning',
      data: defaultPositioning
    })

    return {
      ...state,
      phase: 'draft',
      positioning: defaultPositioning,
      messages: addMessage(state, 'agent', `Using plan-based positioning. Now writing the draft...`, 'positioning').messages
    }
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

