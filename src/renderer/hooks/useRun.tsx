import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { RunState, Message, AgentMessagePayload, AgentEvent, PanelUpdatePayload, AgentId, ToolCall, AgentQuestion, AgentReviewRequest } from '../../shared/types'
import { WorkflowEvent, PendingInput, UserInputResponse, WorkflowPhase } from '../../shared/workflow-types'

// Activity item for the live feed
export interface ActivityItem {
  id: string
  type: AgentEvent['type']
  agentId: AgentId
  timestamp: string
  data: AgentEvent['data']
}

// Pending input from workflow (new state machine)
export interface WorkflowPendingInput {
  runId: string
  phase: WorkflowPhase
  pendingInput: PendingInput
}

interface RunContextValue {
  currentRun: RunState | null
  runs: RunState[]
  isLoading: boolean
  error: string | null
  streamingMessage: { agentId: AgentId; content: string } | null
  streamingReasoning: { agentId: AgentId; content: string } | null
  currentIntent: { agentId: AgentId; intent: string } | null
  activityFeed: ActivityItem[]
  activeTools: Map<string, { name: string; agentId: AgentId; args?: unknown }>
  workflowPhase: WorkflowPhase | null
  workflowPendingInput: WorkflowPendingInput | null
  // Legacy - keeping for compatibility
  pendingQuestion: AgentQuestion | AgentReviewRequest | null
  createRun: (topic: string) => Promise<void>
  startNewChat: () => void
  loadRun: (runId: string) => Promise<void>
  sendMessage: (content: string, mention?: AgentId) => Promise<void>
  editPanel: (panel: string, data: Record<string, unknown>) => Promise<void>
  clearActivity: () => void
  // New workflow response
  respondToWorkflow: (response: UserInputResponse) => Promise<void>
  dismissWorkflowInput: () => Promise<void>
  // Legacy
  respondToQuestion: (response: { answer?: string; selectedIds?: string[] }) => Promise<void>
  dismissQuestion: () => Promise<void>
}

const RunContext = createContext<RunContextValue | null>(null)

export function useRun() {
  const context = useContext(RunContext)
  if (!context) {
    throw new Error('useRun must be used within a RunProvider')
  }
  return context
}

interface RunProviderProps {
  children: ReactNode
}

export function RunProvider({ children }: RunProviderProps) {
  const [currentRun, setCurrentRun] = useState<RunState | null>(null)
  const [runs, setRuns] = useState<RunState[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [streamingMessage, setStreamingMessage] = useState<{ agentId: AgentId; content: string } | null>(null)
  const [streamingReasoning, setStreamingReasoning] = useState<{ agentId: AgentId; content: string } | null>(null)
  const [currentIntent, setCurrentIntent] = useState<{ agentId: AgentId; intent: string } | null>(null)
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([])
  const [activeTools, setActiveTools] = useState<Map<string, { name: string; agentId: AgentId; args?: unknown }>>(new Map())
  const [pendingQuestion, setPendingQuestion] = useState<AgentQuestion | AgentReviewRequest | null>(null)
  // New workflow state
  const [workflowPhase, setWorkflowPhase] = useState<WorkflowPhase | null>(null)
  const [workflowPendingInput, setWorkflowPendingInput] = useState<WorkflowPendingInput | null>(null)

  // Load runs on mount
  useEffect(() => {
    loadRuns()
  }, [])

  // Subscribe to IPC events
  useEffect(() => {
    // Handle rich agent events
    const unsubAgentEvent = window.electron.on.agentEvent((event: AgentEvent) => {
      if (currentRun && event.runId === currentRun.id) {
        // Add to activity feed
        const activityItem: ActivityItem = {
          id: crypto.randomUUID(),
          type: event.type,
          agentId: event.agentId,
          timestamp: event.timestamp,
          data: event.data
        }
        setActivityFeed(prev => [...prev.slice(-50), activityItem]) // Keep last 50 items

        // Handle specific event types
        switch (event.type) {
          case 'intent':
            setCurrentIntent({ agentId: event.agentId, intent: event.data.intent || '' })
            break

          case 'reasoning_delta':
            setStreamingReasoning(prev => ({
              agentId: event.agentId,
              content: (prev?.content || '') + (event.data.deltaContent || '')
            }))
            break

          case 'reasoning':
            setStreamingReasoning(null)
            break

          case 'message_delta':
            setStreamingMessage(prev => ({
              agentId: event.agentId,
              content: (prev?.content || '') + (event.data.deltaContent || '')
            }))
            break

          case 'message':
            setStreamingMessage(null)
            setStreamingReasoning(null)
            // Add message to current run (only if has content)
            if (event.data.content?.trim()) {
              setCurrentRun(prev => {
                if (!prev) return prev
                const newMessage: Message = {
                  id: event.data.messageId || crypto.randomUUID(),
                  role: 'agent',
                  agentId: event.agentId,
                  content: event.data.content || '',
                  timestamp: event.timestamp
                }
                return {
                  ...prev,
                  messages: [...prev.messages, newMessage]
                }
              })
            }
            break

          case 'tool_start':
            setActiveTools(prev => {
              const newMap = new Map(prev)
              newMap.set(event.data.toolCallId || '', {
                name: event.data.toolName || '',
                agentId: event.agentId,
                args: event.data.toolArgs
              })
              return newMap
            })
            break

          case 'tool_complete':
            setActiveTools(prev => {
              const newMap = new Map(prev)
              newMap.delete(event.data.toolCallId || '')
              return newMap
            })
            break

          case 'turn_end':
          case 'idle':
            setCurrentIntent(null)
            setStreamingMessage(null)
            setStreamingReasoning(null)
            break

          case 'error':
            setError(event.data.error || 'Unknown error')
            break
        }
      }
    })

    // Legacy agent message handler (for backward compatibility)
    const unsubAgentMessage = window.electron.on.agentMessage((payload: AgentMessagePayload) => {
      // Handled by agentEvent now, but keep for backward compat
    })

    const unsubAgentError = window.electron.on.agentError((payload) => {
      if (currentRun && payload.runId === currentRun.id) {
        setError(payload.error)
        setStreamingMessage(null)
        setStreamingReasoning(null)
      }
    })

    const unsubPanelUpdate = window.electron.on.panelUpdate((payload: PanelUpdatePayload) => {
      if (currentRun && payload.runId === currentRun.id) {
        setCurrentRun(prev => {
          if (!prev) return prev
          return {
            ...prev,
            [payload.panel]: { ...prev[payload.panel as keyof RunState], ...payload.data }
          }
        })
      }
    })

    // New workflow events (state machine pattern)
    const unsubWorkflowEvent = window.electron.on.workflowEvent((event: WorkflowEvent) => {
      console.log('[useRun] Workflow event:', event.type, event.phase)
      if (currentRun && event.runId === currentRun.id) {
        setWorkflowPhase(event.phase)
        
        // Update messages from workflow state
        if (event.state.messages) {
          setCurrentRun(prev => {
            if (!prev) return prev
            return {
              ...prev,
              messages: event.state.messages
            }
          })
        }
        
        // Clear pending input on phase change (unless it's a waiting phase)
        if (!event.phase.endsWith('_waiting')) {
          setWorkflowPendingInput(null)
        }
        
        if (event.type === 'workflow_complete') {
          setCurrentIntent(null)
          setStreamingMessage(null)
          setStreamingReasoning(null)
        }
        
        if (event.type === 'workflow_error') {
          setError(event.state.error || 'Workflow error')
        }
      }
    })

    const unsubWorkflowPendingInput = window.electron.on.workflowPendingInput((payload) => {
      console.log('[useRun] Workflow pending input:', payload.phase, payload.pendingInput.type)
      if (currentRun && payload.runId === currentRun.id) {
        setWorkflowPendingInput({
          runId: payload.runId,
          phase: payload.phase as WorkflowPhase,
          pendingInput: payload.pendingInput
        })
      }
    })

    // Legacy agent asking for user input (kept for compatibility)
    const unsubAgentAskUser = window.electron.on.agentAskUser((payload) => {
      console.log('[useRun] Received agentAskUser (legacy):', payload)
      if (currentRun && payload.runId === currentRun.id) {
        setPendingQuestion(payload)
      }
    })

    return () => {
      unsubAgentEvent()
      unsubAgentMessage()
      unsubAgentError()
      unsubPanelUpdate()
      unsubWorkflowEvent()
      unsubWorkflowPendingInput()
      unsubAgentAskUser()
    }
  }, [currentRun?.id])

  const loadRuns = async () => {
    try {
      const loadedRuns = await window.electron.invoke.listRuns()
      setRuns(loadedRuns)
    } catch (err) {
      console.error('Failed to load runs:', err)
    }
  }

  const createRun = useCallback(async (topic: string) => {
    setIsLoading(true)
    setError(null)
    setActivityFeed([]) // Clear activity for new run
    try {
      const run = await window.electron.invoke.createRun({ topic })
      setCurrentRun(run)
      setRuns(prev => [run, ...prev])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create run')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Start a fresh chat - clears current run so user can type in input
  const startNewChat = useCallback(() => {
    setCurrentRun(null)
    setActivityFeed([])
    setStreamingMessage(null)
    setStreamingReasoning(null)
    setCurrentIntent(null)
    setWorkflowPhase(null)
    setWorkflowPendingInput(null)
    setPendingQuestion(null)
    setError(null)
  }, [])

  const loadRun = useCallback(async (runId: string) => {
    setIsLoading(true)
    setError(null)
    setActivityFeed([]) // Clear activity when loading different run
    try {
      const run = await window.electron.invoke.getRun(runId)
      if (run) {
        setCurrentRun(run)
      } else {
        setError(`Run ${runId} not found`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load run')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const sendMessage = useCallback(async (content: string, mention?: AgentId) => {
    if (!currentRun) return
    
    // Optimistically add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    }
    setCurrentRun(prev => prev ? { ...prev, messages: [...prev.messages, userMessage] } : prev)
    
    try {
      await window.electron.invoke.sendMessage({
        runId: currentRun.id,
        content,
        mention
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    }
  }, [currentRun])

  const editPanel = useCallback(async (panel: string, data: Record<string, unknown>) => {
    if (!currentRun) return
    
    try {
      await window.electron.invoke.editPanel({
        runId: currentRun.id,
        panel,
        data
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to edit panel')
    }
  }, [currentRun])

  const clearActivity = useCallback(() => {
    setActivityFeed([])
  }, [])

  const respondToQuestion = useCallback(async (response: { answer?: string; selectedIds?: string[] }) => {
    if (!currentRun || !pendingQuestion) return
    
    try {
      await window.electron.invoke.respondToAgent({
        runId: currentRun.id,
        answer: response.answer,
        selectedIds: response.selectedIds
      })
      setPendingQuestion(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to respond')
    }
  }, [currentRun, pendingQuestion])

  const dismissQuestion = useCallback(async () => {
    if (!currentRun || !pendingQuestion) return
    
    try {
      // Send empty response (skip/cancel)
      await window.electron.invoke.respondToAgent({
        runId: currentRun.id,
        selectedIds: []
      })
      setPendingQuestion(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dismiss')
    }
  }, [currentRun, pendingQuestion])

  // New workflow response handlers
  const respondToWorkflow = useCallback(async (response: UserInputResponse) => {
    if (!currentRun || !workflowPendingInput) return
    
    try {
      await window.electron.invoke.respondToWorkflow(currentRun.id, response)
      setWorkflowPendingInput(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to respond to workflow')
    }
  }, [currentRun, workflowPendingInput])

  const dismissWorkflowInput = useCallback(async () => {
    if (!currentRun || !workflowPendingInput) return
    
    try {
      // Send empty response based on pending input type
      const emptyResponse: UserInputResponse = workflowPendingInput.pendingInput.type === 'questions'
        ? { type: 'questions', answers: {} }
        : { type: workflowPendingInput.pendingInput.type, selectedIds: [] }
      
      await window.electron.invoke.respondToWorkflow(currentRun.id, emptyResponse)
      setWorkflowPendingInput(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dismiss workflow input')
    }
  }, [currentRun, workflowPendingInput])

  const value: RunContextValue = {
    currentRun,
    runs,
    isLoading,
    error,
    streamingMessage,
    streamingReasoning,
    currentIntent,
    activityFeed,
    activeTools,
    workflowPhase,
    workflowPendingInput,
    pendingQuestion,
    createRun,
    startNewChat,
    loadRun,
    sendMessage,
    editPanel,
    clearActivity,
    respondToWorkflow,
    dismissWorkflowInput,
    respondToQuestion,
    dismissQuestion
  }

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>
}
