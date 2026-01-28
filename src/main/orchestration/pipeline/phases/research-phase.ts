// Research Phase - Executes research tasks from planner
// NO user checkpoint - trusts the agent to find relevant info

import { CopilotClient, CopilotSession, defineTool } from '@github/copilot-sdk'
import { BrowserWindow } from 'electron'
import { z } from 'zod'
import {
  WorkflowState,
  ResearchFinding,
  addMessage
} from '../../../../shared/workflow-types'
import { ResearchData, Source, AgentEvent } from '../../../../shared/types'
import { IPC_CHANNELS } from '../../../../shared/channels'

const RESEARCH_PROMPT = `You are a research specialist finding information for LinkedIn content.

## YOUR ROLE
Execute research tasks and gather relevant information. Be efficient and focused.

## YOUR TOOLS
- **search_web**: Search for specific information
- **save_research**: Save your findings when done

## GUIDELINES
- Execute the research tasks you're given
- Search for specific, useful information (stats, examples, trends)
- Don't over-research - 2-4 good searches is usually enough
- Focus on recent, credible information
- Save findings that will make the post compelling

## OUTPUT
Save research with:
- Key facts and statistics (with sources)
- Interesting angles or insights discovered
- Any relevant examples or case studies`

export async function runResearchPhase(
  client: CopilotClient,
  mainWindow: BrowserWindow,
  state: WorkflowState
): Promise<WorkflowState> {
  console.log('[research-phase] Starting research phase')

  // Build research context from plan
  const researchTasks = state.plan?.keyPoints || []
  const topic = state.plan?.topic || state.userRequest

  const prompt = `Research topic: "${topic}"

${researchTasks.length > 0 ? `Research tasks:
${researchTasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}` : 'Find relevant statistics, examples, and insights for this topic.'}

Execute these research tasks using search_web, then save your findings using save_research.`

  // Collect research results
  let researchData: ResearchData = {
    sources: [],
    facts: [],
    claims: []
  }

  const sessionId = `${state.runId}-research-${Date.now()}`
  const session = await client.createSession({
    sessionId,
    model: 'Claude Opus 4.5',
    streaming: true,
    systemMessage: { content: RESEARCH_PROMPT },
    tools: [
      defineTool('search_web', {
        description: 'Search the web for specific information',
        parameters: z.object({
          query: z.string().describe('Search query'),
          numResults: z.number().optional().describe('Number of results (default: 5)')
        }),
        handler: async ({ query, numResults = 5 }) => {
          console.log(`[research-phase] search_web: ${query}`)
          const exaApiKey = process.env.EXA_API_KEY
          if (!exaApiKey) {
            return { error: 'EXA_API_KEY not configured' }
          }

          try {
            const response = await fetch('https://api.exa.ai/search', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': exaApiKey
              },
              body: JSON.stringify({
                query,
                numResults,
                type: 'auto',
                useAutoprompt: true,
                contents: {
                  text: { maxCharacters: 1500 }
                }
              })
            })

            if (!response.ok) {
              throw new Error(`Exa API error: ${response.status}`)
            }

            const data = await response.json()
            const results = data.results?.map((r: any) => ({
              title: r.title,
              url: r.url,
              text: r.text?.substring(0, 500),
              publishedDate: r.publishedDate
            })) || []

            console.log(`[research-phase] Found ${results.length} results`)
            return { results }
          } catch (error) {
            console.error('[research-phase] Search error:', error)
            return { error: String(error) }
          }
        }
      }),

      defineTool('save_research', {
        description: 'Save research findings',
        parameters: z.object({
          facts: z.array(z.string()).describe('Key facts and statistics discovered'),
          insights: z.array(z.string()).describe('Interesting angles or insights'),
          sources: z.array(z.object({
            title: z.string(),
            url: z.string(),
            keyInfo: z.string().describe('Most relevant info from this source')
          })).describe('Sources used')
        }),
        handler: async ({ facts, insights, sources }) => {
          console.log(`[research-phase] Saving ${facts.length} facts, ${insights.length} insights`)
          researchData = {
            sources: sources.map((s, i) => ({
              id: `src-${i}`,
              url: s.url,
              title: s.title,
              content: s.keyInfo,
              addedAt: new Date().toISOString()
            })),
            facts,
            claims: insights
          }
          return { success: true }
        }
      })
    ]
  })

  // Stream events to UI
  session.on((event) => {
    emitAgentEvent(mainWindow, state.runId, 'research', event)
  })

  try {
    await session.sendAndWait({ prompt }, 180000) // 3 minutes for research
  } catch (error) {
    console.error('[research-phase] Error:', error)
    throw error
  } finally {
    await session.destroy()
  }

  // Update panel
  mainWindow.webContents.send(IPC_CHANNELS.PANEL_UPDATE, {
    runId: state.runId,
    panel: 'research',
    data: researchData
  })

  // Move directly to positioning - no user checkpoint
  const factsSummary = researchData.facts.length > 0 
    ? `Found ${researchData.facts.length} key facts.`
    : 'Research complete.'

  return {
    ...state,
    phase: 'positioning',
    research: researchData,
    pendingInput: null,
    messages: addMessage(state, 'agent', `${factsSummary} Now crafting the positioning...`, 'research').messages
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

