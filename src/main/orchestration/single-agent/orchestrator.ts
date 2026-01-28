// Single-Agent Orchestrator - True conversational agent with tools
// One long-running session per run, pure chat experience

import { EventEmitter } from 'events'
import { BrowserWindow } from 'electron'
import { CopilotClient, CopilotSession, defineTool } from '@github/copilot-sdk'
import { z } from 'zod'
import {
  WorkflowState,
  UserInputResponse
} from '../../../shared/workflow-types'
import { IPC_CHANNELS } from '../../../shared/channels'
import { updateRun } from '../../storage/runs'
import { IWorkflowOrchestrator } from '../interface'

const SYSTEM_PROMPT = `You are a LinkedIn Content Creator assistant. You help users create compelling LinkedIn posts through natural conversation.

## YOUR TOOLS
- **search_web** - Search for information, stats, trends, examples
- **save_research** - Save key facts and sources to the research panel
- **set_positioning** - Define the content strategy (audience, tone, angle)
- **write_draft** - Write the LinkedIn post
- **improve_draft** - Refine and improve an existing draft
- **generate_image** - Create a poster image for the post

## HOW TO WORK
1. Have a natural conversation with the user
2. Use tools to update the panels - they show your work in real-time
3. When creating a new post:
   - Research if needed (search_web → save_research)
   - Define positioning (set_positioning) 
   - Write the draft (write_draft)
   - Improve it (improve_draft)
   - Generate image when ready (generate_image)
4. For edits/changes, just update what's needed (e.g., improve_draft for text changes)

## ALWAYS UPDATE PANELS
- Use save_research after searching to show findings
- Use set_positioning to show your strategy
- Use write_draft/improve_draft to show the post
- The user sees these panels - keep them updated!

## LINKEDIN POST BEST PRACTICES
- Hook: First line MUST stop the scroll
- Body: Short paragraphs, one idea each
- Include specific data/stats when available
- End with engagement prompt
- 1300-2000 characters ideal
- 3-5 relevant hashtags

## CRITICAL
- NEVER fabricate facts or experiences
- If you don't know something, search for it
- Be conversational, not robotic`

interface RunState {
  draft?: string
  research?: string[]
  sources?: Array<{ title: string; url: string }>
  positioning?: { audience: string; tone: string; angle: string }
}

export class SingleAgentOrchestrator extends EventEmitter implements IWorkflowOrchestrator {
  private client: CopilotClient | null = null
  private mainWindow: BrowserWindow
  private sessions: Map<string, CopilotSession> = new Map()
  private runStates: Map<string, RunState> = new Map()

  constructor(mainWindow: BrowserWindow) {
    super()
    this.mainWindow = mainWindow
  }

  async initialize(): Promise<void> {
    if (this.client) return

    this.client = new CopilotClient({
      autoStart: true,
      autoRestart: true,
      logLevel: 'info'
    })

    await this.client.start()
    console.log('[single-agent] Copilot SDK client started')
  }

  async startWorkflow(runId: string, userRequest: string): Promise<void> {
    if (!this.client) {
      await this.initialize()
    }

    console.log(`[single-agent] Message for run ${runId}: ${userRequest.substring(0, 50)}...`)

    // Get or create session for this run
    let session = this.sessions.get(runId)
    
    if (!session) {
      session = await this.createSession(runId)
      this.sessions.set(runId, session)
    }

    // Send the message
    try {
      await session.sendAndWait({ prompt: userRequest }, 180000) // 3 min timeout
    } catch (error) {
      console.error('[single-agent] Error:', error)
      this.emitAgentMessage(runId, `Sorry, something went wrong. Please try again.`)
    }
  }

  async handleFollowUp(runId: string, userRequest: string): Promise<void> {
    // Same as startWorkflow - just send another message to the session
    await this.startWorkflow(runId, userRequest)
  }

  async handleUserResponse(_runId: string, _response: UserInputResponse): Promise<void> {
    // Not used in single-agent mode - no pending inputs
  }

  getState(runId: string): WorkflowState | undefined {
    // Return a minimal state for compatibility
    const state = this.runStates.get(runId)
    return {
      runId,
      phase: 'complete',
      userRequest: '',
      pendingInput: null,
      draft: state?.draft,
      messages: []
    }
  }

  isWorkflowComplete(_runId: string): boolean {
    // Single-agent is never "complete" - it's always ready for more messages
    return false
  }

  private async createSession(runId: string): Promise<CopilotSession> {
    const runState = this.runStates.get(runId) || {}
    
    const session = await this.client!.createSession({
      sessionId: `single-agent-${runId}`,
      model: 'Claude Sonnet 4',
      streaming: true,
      systemMessage: { content: SYSTEM_PROMPT },
      tools: [
        // Search tool
        defineTool('search_web', {
          description: 'Search the web for information, statistics, trends, or examples.',
          parameters: z.object({
            query: z.string().describe('What to search for')
          }),
          handler: async ({ query }) => {
            console.log(`[single-agent] Searching: ${query}`)
            this.emitToolEvent(runId, 'search_web', 'start')
            
            try {
              const response = await fetch('https://api.exa.ai/search', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${process.env.EXA_API_KEY}`
                },
                body: JSON.stringify({
                  query,
                  numResults: 5,
                  type: 'auto',
                  contents: { text: { maxCharacters: 1500 } }
                })
              })
              
              if (!response.ok) {
                return { error: 'Search failed' }
              }
              
              const data = await response.json()
              const results = data.results?.slice(0, 4).map((r: any) => ({
                title: r.title,
                url: r.url,
                content: r.text?.substring(0, 500)
              })) || []

              // Store research
              const facts = results.map((r: any) => r.content).filter(Boolean)
              runState.research = [...(runState.research || []), ...facts]
              this.runStates.set(runId, runState)

              // Update research panel
              this.mainWindow.webContents.send(IPC_CHANNELS.PANEL_UPDATE, {
                runId,
                panel: 'research',
                data: {
                  facts: runState.research,
                  sources: results.map((r: any) => ({ title: r.title, url: r.url }))
                }
              })
              
              this.emitToolEvent(runId, 'search_web', 'complete')
              return { results }
            } catch (error) {
              this.emitToolEvent(runId, 'search_web', 'complete')
              return { error: String(error) }
            }
          }
        }),

        // Write post tool
        defineTool('save_research', {
          description: 'Save research findings to the research panel. Call after searching to show key facts.',
          parameters: z.object({
            facts: z.array(z.string()).describe('Key facts, statistics, or insights discovered'),
            sources: z.array(z.object({
              title: z.string(),
              url: z.string()
            })).optional().describe('Sources for the facts')
          }),
          handler: async ({ facts, sources }) => {
            console.log(`[single-agent] Saving ${facts.length} research facts`)
            
            // Convert sources to full Source type
            const fullSources = (sources || []).map((s, i) => ({
              id: `src-${Date.now()}-${i}`,
              title: s.title,
              url: s.url,
              content: '',
              addedAt: new Date().toISOString()
            }))
            
            // Store research
            runState.research = facts
            runState.sources = fullSources
            this.runStates.set(runId, runState)
            
            // Update research panel
            this.mainWindow.webContents.send(IPC_CHANNELS.PANEL_UPDATE, {
              runId,
              panel: 'research',
              data: {
                facts,
                sources: fullSources
              }
            })

            // Persist
            await updateRun(runId, {
              research: {
                facts,
                sources: fullSources,
                claims: []
              }
            })
            
            return { success: true, factCount: facts.length }
          }
        }),

        // Positioning tool
        defineTool('set_positioning', {
          description: 'Define the content positioning strategy. Updates the positioning panel.',
          parameters: z.object({
            audience: z.string().describe('Target audience description'),
            tone: z.string().describe('Tone of voice (e.g., professional, conversational, bold)'),
            angle: z.string().describe('Unique angle or perspective for the post'),
            painPoints: z.array(z.string()).optional().describe('Pain points the audience faces')
          }),
          handler: async ({ audience, tone, angle, painPoints }) => {
            console.log(`[single-agent] Setting positioning: ${audience}`)
            
            const positioning = { 
              audience, 
              tone, 
              angle,
              painPoints: painPoints || []
            }
            runState.positioning = positioning
            this.runStates.set(runId, runState)
            
            // Update positioning panel
            this.mainWindow.webContents.send(IPC_CHANNELS.PANEL_UPDATE, {
              runId,
              panel: 'positioning',
              data: positioning
            })

            // Persist
            await updateRun(runId, { positioning })
            
            return { success: true }
          }
        }),

        // Write draft tool
        defineTool('write_draft', {
          description: 'Write the initial LinkedIn post draft. Updates the draft panel.',
          parameters: z.object({
            content: z.string().describe('The full LinkedIn post content')
          }),
          handler: async ({ content }) => {
            console.log(`[single-agent] Writing draft (${content.length} chars)`)
            
            runState.draft = content
            this.runStates.set(runId, runState)
            
            // Update draft panel
            this.mainWindow.webContents.send(IPC_CHANNELS.PANEL_UPDATE, {
              runId,
              panel: 'draft',
              data: { 
                fullText: content, 
                characterCount: content.length 
              }
            })

            // Persist
            await updateRun(runId, {
              draft: {
                fullText: content,
                hook: '',
                body: '',
                cta: '',
                characterCount: content.length
              }
            })
            
            return { 
              success: true, 
              characterCount: content.length,
              warning: content.length > 3000 ? 'Post exceeds 3000 characters' : undefined
            }
          }
        }),

        // Improve draft tool
        defineTool('improve_draft', {
          description: 'Improve or edit the existing draft. Use for any changes to the post.',
          parameters: z.object({
            content: z.string().describe('The improved/edited LinkedIn post content'),
            changes: z.string().optional().describe('Brief description of what was changed')
          }),
          handler: async ({ content, changes }) => {
            console.log(`[single-agent] Improving draft (${content.length} chars)${changes ? `: ${changes}` : ''}`)
            
            runState.draft = content
            this.runStates.set(runId, runState)
            
            // Update draft panel
            this.mainWindow.webContents.send(IPC_CHANNELS.PANEL_UPDATE, {
              runId,
              panel: 'draft',
              data: { 
                fullText: content, 
                characterCount: content.length 
              }
            })

            // Persist
            await updateRun(runId, {
              draft: {
                fullText: content,
                hook: '',
                body: '',
                cta: '',
                characterCount: content.length
              }
            })
            
            return { 
              success: true, 
              characterCount: content.length,
              warning: content.length > 3000 ? 'Post exceeds 3000 characters' : undefined
            }
          }
        }),

        // Generate image tool
        defineTool('generate_image', {
          description: 'Generate a poster image for the LinkedIn post.',
          parameters: z.object({
            style: z.string().optional().describe('Visual style direction (e.g., "dark tech aesthetic", "clean professional")')
          }),
          handler: async ({ style }) => {
            console.log(`[single-agent] Generating image${style ? ` with style: ${style}` : ''}`)
            this.emitToolEvent(runId, 'generate_image', 'start')
            
            const openaiApiKey = process.env.OPENAI_API_KEY
            if (!openaiApiKey) {
              this.emitToolEvent(runId, 'generate_image', 'complete')
              return { error: 'No OpenAI API key configured' }
            }

            // Show generating state
            this.mainWindow.webContents.send(IPC_CHANNELS.PANEL_UPDATE, {
              runId,
              panel: 'image',
              data: { status: 'generating' }
            })

            const draft = runState.draft || ''
            let prompt = `Create a poster image for this LinkedIn post:\n\n${draft}`
            if (style) {
              prompt += `\n\nVisual style: ${style}`
            }
            
            try {
              const response = await fetch('https://api.openai.com/v1/images/generations', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${openaiApiKey}`
                },
                body: JSON.stringify({
                  model: 'gpt-image-1.5',
                  prompt,
                  n: 1,
                  size: '1024x1024',
                  quality: 'high'
                })
              })
              
              if (!response.ok) {
                const error = await response.text()
                this.mainWindow.webContents.send(IPC_CHANNELS.PANEL_UPDATE, {
                  runId,
                  panel: 'image',
                  data: { status: 'error' }
                })
                this.emitToolEvent(runId, 'generate_image', 'complete')
                return { error: `Image generation failed: ${error}` }
              }
              
              const data = await response.json()
              const imageBase64 = data.data?.[0]?.b64_json
              
              if (imageBase64) {
                const imageUrl = `data:image/png;base64,${imageBase64}`
                
                // Update image panel
                this.mainWindow.webContents.send(IPC_CHANNELS.PANEL_UPDATE, {
                  runId,
                  panel: 'image',
                  data: { 
                    url: imageUrl, 
                    altText: data.data?.[0]?.revised_prompt || 'Generated image',
                    status: 'ready' 
                  }
                })

                // Persist
                await updateRun(runId, {
                  image: {
                    url: imageUrl,
                    altText: data.data?.[0]?.revised_prompt || '',
                    status: 'ready'
                  }
                })
                
                this.emitToolEvent(runId, 'generate_image', 'complete')
                return { success: true, message: 'Image generated!' }
              }
              
              this.emitToolEvent(runId, 'generate_image', 'complete')
              return { error: 'No image data returned' }
            } catch (error) {
              this.mainWindow.webContents.send(IPC_CHANNELS.PANEL_UPDATE, {
                runId,
                panel: 'image',
                data: { status: 'error' }
              })
              this.emitToolEvent(runId, 'generate_image', 'complete')
              return { error: String(error) }
            }
          }
        })
      ]
    })

    // Stream events to UI
    session.on((event: any) => {
      if (event.type === 'assistant.message_delta' && event.data?.deltaContent) {
        // Stream message content
        this.mainWindow.webContents.send(IPC_CHANNELS.AGENT_EVENT, {
          type: 'message_delta',
          runId,
          agentId: 'single-agent',
          timestamp: new Date().toISOString(),
          data: { content: event.data.deltaContent }
        })
      } else if (event.type === 'assistant.message' && event.data?.content) {
        // Final message
        this.emitAgentMessage(runId, event.data.content)
      }
    })

    return session
  }

  private emitAgentMessage(runId: string, content: string): void {
    if (this.mainWindow.isDestroyed()) return
    
    this.mainWindow.webContents.send(IPC_CHANNELS.AGENT_EVENT, {
      type: 'message',
      runId,
      agentId: 'single-agent',
      timestamp: new Date().toISOString(),
      data: { content }
    })
  }

  private emitToolEvent(runId: string, toolName: string, status: 'start' | 'complete'): void {
    if (this.mainWindow.isDestroyed()) return
    
    this.mainWindow.webContents.send(IPC_CHANNELS.AGENT_EVENT, {
      type: status === 'start' ? 'tool_start' : 'tool_complete',
      runId,
      agentId: 'single-agent',
      timestamp: new Date().toISOString(),
      data: { toolName }
    })
  }

  async destroy(): Promise<void> {
    // Destroy all sessions
    for (const [runId, session] of this.sessions) {
      try {
        await session.destroy()
      } catch (e) {
        console.error(`[single-agent] Error destroying session ${runId}:`, e)
      }
    }
    this.sessions.clear()
    this.runStates.clear()

    if (this.client) {
      await this.client.stop()
      this.client = null
    }
    console.log('[single-agent] Shutdown complete')
  }
}
