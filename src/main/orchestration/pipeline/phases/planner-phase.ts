// Planner Phase - Analyzes request, asks ONLY if needed, outputs task list
// Truly agentic - decides what it needs to know

import { CopilotClient, defineTool } from '@github/copilot-sdk'
import { BrowserWindow } from 'electron'
import { z } from 'zod'
import {
  WorkflowState,
  ClarifyingQuestion,
  ContentPlan,
  addMessage
} from '../../../../shared/workflow-types'
import { IPC_CHANNELS } from '../../../../shared/channels'
import { AgentEvent } from '../../../../shared/types'

const PLANNER_PROMPT = `You are an autonomous content strategist for LinkedIn posts.

## YOUR MINDSET
You think like a skilled content creator who understands context:
- You analyze what the user ACTUALLY needs
- You only do what's necessary - no more, no less
- You adapt based on what already exists

## ANALYZING THE REQUEST

Look at what you're given:
- Is this a NEW post request or a FOLLOW-UP on existing work?
- If there's already a draft, what does the user want changed?
- What's the minimum work needed to achieve their goal?

## DECISION TREE

**For NEW posts:**
- Determine if clarification is needed
- Create a full plan with research tasks

**For FOLLOW-UPS (existing draft/research):**
- Analyze what the user wants: edit, expand, change tone, new angle, etc.
- Decide what phases are actually needed:
  - Just a draft edit? → skip research, go straight to draft
  - Need new information? → research first, then draft
  - New visual? → just update visual direction
  - Complete rewrite? → start fresh with research

## TOOLS
- **submit_questions**: Ask 1-3 clarifying questions (ONLY if genuinely needed)
- **submit_plan**: Create or update the content plan

## PLAN OUTPUT

**For new posts:**
- Research tasks, audience profile, visual direction

**For follow-ups:**
- What needs to change and why
- Which phases to run (skip unnecessary ones)
- Specific instructions for those phases

Be efficient. If the user says "make it shorter" - you don't need new research.
If they say "add more data" - you might need research but keep the existing angle.`

// Extended plan type with research tasks and visual direction
interface AgenticPlan {
  topic: string
  intent: string  // What the user wants to achieve
  researchTasks: string[]  // Specific things to research
  audienceProfile: string  // Who we're writing for and what they care about
  visualDirection: string  // Guidance for image generation
  skipResearch?: boolean  // Skip research for simple edits
  skipPositioning?: boolean  // Skip positioning phase
  skipCritic?: boolean  // Skip critic phase
  skipImage?: boolean  // Skip image generation
  draftInstructions?: string  // Specific instructions for draft phase
  angle?: string  // If clear from context
  context?: string  // Any user-provided context
}

export async function runPlannerPhase(
  client: CopilotClient,
  mainWindow: BrowserWindow,
  state: WorkflowState
): Promise<WorkflowState> {
  console.log('[planner-phase] Starting planner phase')

  // Check if we have user answers (second run)
  const hasAnswers = state.plannerAnswers && Object.keys(state.plannerAnswers).length > 0

  // Build the prompt
  let prompt: string
  if (hasAnswers) {
    // Second run - we have answers, create the plan
    const answersText = Object.entries(state.plannerAnswers!)
      .map(([q, a]) => `Q: ${q}\nA: ${a}`)
      .join('\n\n')
    
    prompt = `Create a LinkedIn post about: "${state.userRequest}"

User clarifications:
${answersText}

Now use submit_plan to create a plan based on their answers.`
  } else {
    // Build context about existing work
    const hasExistingDraft = !!state.draft || !!state.finalDraft
    const hasExistingResearch = state.research && state.research.facts.length > 0
    
    let existingContext = ''
    if (hasExistingDraft || hasExistingResearch) {
      existingContext = `\n\n## EXISTING WORK\n`
      if (hasExistingResearch) {
        existingContext += `Research already done:\n${state.research!.facts.slice(0, 3).map(f => `- ${f}`).join('\n')}\n\n`
      }
      if (hasExistingDraft) {
        const draft = state.finalDraft || state.draft
        existingContext += `Current draft:\n"""\n${draft!.substring(0, 500)}${draft!.length > 500 ? '...' : ''}\n"""\n`
      }
      if (state.positioning) {
        existingContext += `\nCurrent positioning: ${state.positioning.angle} for ${state.positioning.audience}\n`
      }
    }

    prompt = `User request: "${state.userRequest}"
${existingContext}
Analyze this request and determine what's needed:
${hasExistingDraft ? '- This is a FOLLOW-UP. What changes does the user want?' : '- This is a NEW post request.'}
${hasExistingDraft ? '- Decide which phases are needed (skip unnecessary work)' : '- Create a full plan with research tasks'}

Use submit_plan to define what should happen next.`
  }

  // Variables to capture tool results
  let questions: ClarifyingQuestion[] = []
  let plan: AgenticPlan | null = null

  // Create short-lived session
  const sessionId = `${state.runId}-planner-${Date.now()}`
  const session = await client.createSession({
    sessionId,
    model: 'Claude Sonnet 4',
    streaming: true,
    systemMessage: { content: PLANNER_PROMPT },
    tools: [
      defineTool('submit_questions', {
        description: 'Ask clarifying questions ONLY if genuinely needed. Skip this if the request is clear.',
        parameters: z.object({
          questions: z.array(z.object({
            id: z.string().describe('Unique ID'),
            question: z.string().describe('A specific clarifying question'),
            options: z.array(z.string()).optional().describe('2-4 options if applicable')
          })).max(3)
        }),
        handler: async ({ questions: qs }) => {
          console.log('[planner-phase] Received questions:', qs.length)
          questions = qs.map(q => ({
            id: q.id,
            question: q.question,
            options: q.options
          }))
          return { success: true, questionCount: questions.length }
        }
      }),

      defineTool('submit_plan', {
        description: 'Create or update the content plan. For follow-ups, specify which phases to run.',
        parameters: z.object({
          topic: z.string().describe('The main topic'),
          intent: z.string().describe('What the user wants to achieve'),
          researchTasks: z.array(z.string()).describe('Research tasks to execute. Empty array [] if no research needed (e.g., for simple edits)'),
          audienceProfile: z.string().describe('Who the audience is and what they care about'),
          visualDirection: z.string().describe('Guidance for the image - aesthetic, style, key elements'),
          skipResearch: z.boolean().optional().describe('True to skip research phase (for edits that don\'t need new info)'),
          skipPositioning: z.boolean().optional().describe('True to skip positioning phase (use existing positioning)'),
          skipCritic: z.boolean().optional().describe('True to skip critic phase (for minor edits)'),
          skipImage: z.boolean().optional().describe('True to skip image generation'),
          draftInstructions: z.string().optional().describe('Specific instructions for the draft phase (e.g., "Make it shorter", "Add a personal story", "Change to conversational tone")'),
          angle: z.string().optional().describe('The angle if already clear'),
          context: z.string().optional().describe('Any relevant context')
        }),
        handler: async (p) => {
          console.log('[planner-phase] Received plan')
          console.log('[planner-phase] Skip research:', p.skipResearch)
          console.log('[planner-phase] Skip positioning:', p.skipPositioning)
          console.log('[planner-phase] Skip critic:', p.skipCritic)
          console.log('[planner-phase] Draft instructions:', p.draftInstructions?.substring(0, 50))
          plan = p as AgenticPlan
          return { success: true }
        }
      })
    ]
  })

  // Stream events to UI
  session.on((event) => {
    emitAgentEvent(mainWindow, state.runId, 'planner', event)
  })

  // Run the session
  try {
    await session.sendAndWait({ prompt }, 120000)
  } catch (error) {
    console.error('[planner-phase] Error:', error)
    throw error
  } finally {
    await session.destroy()
  }

  // Determine next state based on results
  if (questions.length > 0 && !hasAnswers) {
    // Questions needed
    console.log('[planner-phase] Returning with questions for user')
    return {
      ...state,
      phase: 'planner_waiting',
      pendingInput: {
        type: 'questions',
        questions
      },
      messages: addMessage(state, 'agent', `I have a few questions to make sure I create the right post for you.`, 'planner').messages
    }
  } else if (plan) {
    // Plan ready - convert to ContentPlan format for compatibility
    const p = plan as AgenticPlan  // TypeScript inference helper
    const contentPlan: ContentPlan = {
      topic: p.topic,
      angle: p.angle || p.intent,
      targetAudience: p.audienceProfile || 'LinkedIn professionals',
      keyPoints: p.researchTasks,
      tone: 'professional',
      includeStats: p.researchTasks.some((t: string) => t.toLowerCase().includes('stat') || t.toLowerCase().includes('data')),
      includeStory: p.researchTasks.some((t: string) => t.toLowerCase().includes('case') || t.toLowerCase().includes('example'))
    }
    
    // Determine next phase based on plan
    let nextPhase: WorkflowState['phase'] = 'research'
    let statusMessage = ''
    
    if (p.skipResearch || p.researchTasks.length === 0) {
      // Skip research, go to positioning or draft
      nextPhase = p.skipPositioning ? 'draft' : 'positioning'
      statusMessage = p.draftInstructions 
        ? `Got it! I'll update the draft: ${p.draftInstructions.substring(0, 50)}...`
        : `Got it! Updating the post...`
    } else {
      statusMessage = `Got it! I'll research: ${p.researchTasks.slice(0, 2).join(', ')}${p.researchTasks.length > 2 ? '...' : ''}`
    }
    
    console.log('[planner-phase] Plan complete, moving to:', nextPhase)
    return {
      ...state,
      phase: nextPhase,
      plan: contentPlan,
      visualDirection: p.visualDirection,
      // Pass through control flags
      skipResearch: p.skipResearch,
      skipPositioning: p.skipPositioning,
      skipCritic: p.skipCritic,
      skipImage: p.skipImage,
      draftInstructions: p.draftInstructions,
      pendingInput: null,
      messages: addMessage(state, 'agent', statusMessage, 'planner').messages
    }
  } else {
    console.error('[planner-phase] No questions or plan received')
    return {
      ...state,
      phase: 'error',
      error: 'Planner failed to generate questions or plan'
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

