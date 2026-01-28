// Image Phase - Generates contextual visual based on FULL post content
// Directly sends full context to OpenAI - no compression through LLM description

import { BrowserWindow } from 'electron'
import { WorkflowState, addMessage } from '../../../../shared/workflow-types'
import { AgentEvent } from '../../../../shared/types'
import { IPC_CHANNELS } from '../../../../shared/channels'

export async function runImagePhase(
  _client: unknown,  // Not using Copilot SDK for this phase
  mainWindow: BrowserWindow,
  state: WorkflowState
): Promise<WorkflowState> {
  console.log('[image-phase] Starting image phase')

  const draft = state.finalDraft || state.draft
  if (!draft) {
    return {
      ...state,
      phase: 'complete',
      messages: addMessage(state, 'agent', `✨ Done! Your post is ready.`, 'image').messages
    }
  }

  // Check for OpenAI API key
  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey) {
    console.log('[image-phase] No OpenAI API key, skipping image generation')
    return {
      ...state,
      phase: 'complete',
      messages: addMessage(state, 'agent', `✨ Done! Your post is ready. (Add OPENAI_API_KEY for image generation)`, 'image').messages
    }
  }

  // Send generating status
  mainWindow.webContents.send(IPC_CHANNELS.PANEL_UPDATE, {
    runId: state.runId,
    panel: 'image',
    data: { status: 'generating' }
  })

  // Emit event for UI
  emitAgentEvent(mainWindow, state.runId, 'image', {
    type: 'tool.execution_start',
    data: { toolName: 'generate_image', toolCallId: 'img-1' }
  })

  let imageUrl = ''
  let imagePrompt = ''

  try {
    // Build prompt with draft and visual direction from planner
    let imagePromptText = `Create a poster image for the following LinkedIn post:\n\n${draft}`
    
    if (state.visualDirection) {
      imagePromptText += `\n\nVisual style direction: ${state.visualDirection}`
    }
    
    console.log('[image-phase] Calling OpenAI Images API with gpt-image-1.5')

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-image-1.5',
        prompt: imagePromptText,
        n: 1,
        size: '1024x1024',
        quality: 'high'
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[image-phase] API error:', error)
      throw new Error(`Image generation failed: ${error}`)
    }

    const data = await response.json() as {
      data: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>
    }

    const imageData = data.data?.[0]
    const imageBase64 = imageData?.b64_json

    if (!imageBase64) {
      throw new Error('No image data returned')
    }

    imageUrl = `data:image/png;base64,${imageBase64}`
    imagePrompt = imageData?.revised_prompt || 'Generated image'

    console.log('[image-phase] Image generated successfully')

  } catch (error) {
    console.error('[image-phase] Error:', error)
    // Don't fail workflow for image errors
  }

  // Emit completion event
  emitAgentEvent(mainWindow, state.runId, 'image', {
    type: 'tool.execution_complete',
    data: { toolCallId: 'img-1', toolName: 'generate_image' }
  })

  // Update image panel
  if (imageUrl) {
    mainWindow.webContents.send(IPC_CHANNELS.PANEL_UPDATE, {
      runId: state.runId,
      panel: 'image',
      data: {
        url: imageUrl,
        altText: imagePrompt,
        status: 'ready'
      }
    })
  } else {
    mainWindow.webContents.send(IPC_CHANNELS.PANEL_UPDATE, {
      runId: state.runId,
      panel: 'image',
      data: { status: 'error' }
    })
  }

  return {
    ...state,
    phase: 'complete',
    imageUrl: imageUrl || undefined,
    imagePrompt: imagePrompt || undefined,
    messages: addMessage(
      state, 
      'agent', 
      imageUrl 
        ? `✨ All done! Your post and image are ready. Review and publish when ready!`
        : `✨ Done! Your post is ready. (Image generation failed - you can add one manually)`,
      'image'
    ).messages
  }
}

function emitAgentEvent(
  mainWindow: BrowserWindow,
  runId: string,
  agentId: string,
  event: { type: string; data: any }
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

