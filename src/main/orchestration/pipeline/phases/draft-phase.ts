// Draft Phase - Writes the LinkedIn post
// No user interaction - runs quickly and moves to critic

import { CopilotClient, defineTool } from '@github/copilot-sdk'
import { BrowserWindow } from 'electron'
import { z } from 'zod'
import { WorkflowState, addMessage } from '../../../../shared/workflow-types'
import { AgentEvent } from '../../../../shared/types'
import { IPC_CHANNELS } from '../../../../shared/channels'

const DRAFT_PROMPT = `You are a LinkedIn Content Writer specializing in high-performing posts.

## YOUR ROLE
Write compelling LinkedIn posts that drive engagement. You create:
- Attention-grabbing hooks (first line is crucial!)
- Scannable, value-dense content
- Clear calls-to-action

## YOUR TOOL
- **submit_draft**: Submit the completed LinkedIn post

## LINKEDIN POST STRUCTURE
1. **Hook** (Line 1): Must stop the scroll. Use curiosity, contrarian take, or bold statement.
2. **Body**: Short paragraphs, each making ONE point. Use line breaks liberally.
3. **Credibility**: Include specific data, stats, or sources where relevant.
4. **CTA**: End with engagement prompt (question, call to comment, etc.)

## FORMAT GUIDELINES
- 1300-2000 characters ideal (max 3000)
- Short sentences and paragraphs
- Use emojis sparingly (0-3 max)
- Include relevant hashtags at the end (3-5)
- Include source links naturally in the text when citing data

## WHAT MAKES POSTS VIRAL
- Specific, not generic
- Personal perspective or experience
- Counterintuitive insights
- Practical, actionable takeaways
- Authentic voice, not corporate speak

## CRITICAL: NEVER FABRICATE
- Do NOT invent facts, timelines, or experiences (e.g., "I spent 3 months...")
- Only include details explicitly provided in the context
- If no personal story was shared, don't create one
- Write from provided facts, not assumptions
- It's better to be authentic than to make up impressive-sounding details`

export async function runDraftPhase(
  client: CopilotClient,
  mainWindow: BrowserWindow,
  state: WorkflowState
): Promise<WorkflowState> {
  console.log('[draft-phase] Starting draft phase')

  // Build comprehensive context
  const planContext = state.plan
    ? `Content Plan:
- Topic: ${state.plan.topic}
- Audience: ${state.plan.targetAudience}
- Goal: ${state.plan.includeStory ? 'Include personal story' : 'Data-driven insights'}
- Include stats: ${state.plan.includeStats ? 'Yes' : 'If available'}`
    : ''

  const positioningContext = state.positioning
    ? `Positioning:
- Angle: ${state.positioning.angle}
- Audience: ${state.positioning.audience}
- Pain Points: ${state.positioning.painPoints.join(', ')}
- Tone: ${state.positioning.tone}`
    : ''

  const researchContext = state.research?.sources?.length
    ? `Research Sources (cite where relevant):
${state.research.sources.map(s => `- ${s.title}: ${s.content?.substring(0, 200)}... (${s.url})`).join('\n')}`
    : ''

  // Check for specific draft instructions (for follow-ups/edits)
  const existingDraft = state.finalDraft || state.draft
  const draftInstructions = state.draftInstructions

  let prompt: string
  if (existingDraft && draftInstructions) {
    // This is an edit/update to existing draft
    prompt = `Update this LinkedIn post based on the user's instructions:

CURRENT DRAFT:
"""
${existingDraft}
"""

INSTRUCTIONS: ${draftInstructions}

${positioningContext}

Apply the requested changes while maintaining the post's core value. Use submit_draft to submit the updated post.`
  } else {
    // New draft
    prompt = `Write a LinkedIn post based on the following:

${planContext}

${positioningContext}

${researchContext}

Create a compelling post that:
1. Hooks the reader immediately
2. Delivers value in a scannable format
3. Uses the specified tone
4. Includes source links when citing data
5. Ends with hashtags (3-5)

Use submit_draft to submit the complete post.`
  }

  let draft = ''

  const sessionId = `${state.runId}-draft-${Date.now()}`
  const session = await client.createSession({
    sessionId,
    model: 'Claude Sonnet 4',
    streaming: true,
    systemMessage: { content: DRAFT_PROMPT },
    tools: [
      defineTool('submit_draft', {
        description: 'Submit the completed LinkedIn post',
        parameters: z.object({
          post: z.string().describe('The complete LinkedIn post text including hashtags')
        }),
        handler: async ({ post }) => {
          console.log(`[draft-phase] Received draft: ${post.length} chars`)
          draft = post
          return { success: true, characterCount: post.length }
        }
      })
    ]
  })

  // Stream events to UI
  session.on((event) => {
    emitAgentEvent(mainWindow, state.runId, 'draft', event)
  })

  try {
    await session.sendAndWait({ prompt }, 90000) // 90 seconds for writing
  } catch (error) {
    console.error('[draft-phase] Error:', error)
    throw error
  } finally {
    await session.destroy()
  }

  if (draft) {
    // Emit panel update
    mainWindow.webContents.send(IPC_CHANNELS.PANEL_UPDATE, {
      runId: state.runId,
      panel: 'draft',
      data: {
        fullText: draft,
        hook: '',
        body: '',
        cta: '',
        characterCount: draft.length
      }
    })

    return {
      ...state,
      phase: 'critic',
      draft,
      messages: addMessage(state, 'agent', `Draft complete (${draft.length} characters). Now reviewing for improvements...`, 'draft').messages
    }
  } else {
    return {
      ...state,
      phase: 'error',
      error: 'Failed to generate draft'
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

