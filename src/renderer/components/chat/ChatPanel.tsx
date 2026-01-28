import { useState, useRef, useEffect } from 'react'
import { Send, AtSign, Wrench, Loader2 } from 'lucide-react'
import { useRun } from '../../hooks/useRun'
import { AgentId } from '../../../shared/types'
import { ChatMessage } from './ChatMessage'

const AGENTS: { id: AgentId; name: string; color: string; bgColor: string }[] = [
  { id: 'conductor', name: 'Conductor', color: 'text-indigo-400', bgColor: 'bg-indigo-500/10' },
  { id: 'planner', name: 'Planner', color: 'text-violet-400', bgColor: 'bg-violet-500/10' },
  { id: 'research', name: 'Research', color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
  { id: 'positioning', name: 'Positioning', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
  { id: 'draft', name: 'Draft', color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
  { id: 'critic', name: 'Critic', color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
  { id: 'image', name: 'Image', color: 'text-pink-400', bgColor: 'bg-pink-500/10' },
]

// Inline thinking indicator component
function ThinkingIndicator({ 
  agentId, 
  intent, 
  reasoning, 
  activeTools 
}: { 
  agentId: AgentId
  intent?: string
  reasoning?: string
  activeTools: Map<string, { name: string; agentId: AgentId }>
}) {
  const agent = AGENTS.find(a => a.id === agentId)
  const agentTools = Array.from(activeTools.entries()).filter(([_, t]) => t.agentId === agentId)
  const reasoningRef = useRef<HTMLDivElement>(null)
  
  // Auto-scroll reasoning as it streams
  useEffect(() => {
    if (reasoningRef.current && reasoning) {
      reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight
    }
  }, [reasoning])
  
  return (
    <div className={`rounded-xl p-4 ${agent?.bgColor} border border-zinc-800 animate-pulse`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${agent?.bgColor} border border-zinc-700`}>
          <Loader2 className={`w-4 h-4 ${agent?.color} animate-spin`} />
        </div>
        <span className={`font-medium ${agent?.color}`}>{agent?.name}</span>
        {intent && (
          <span className="text-xs text-zinc-400 ml-2">• {intent}</span>
        )}
      </div>
      
      {/* Active tools */}
      {agentTools.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {agentTools.map(([id, tool]) => (
            <span 
              key={id} 
              className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-800 rounded-full text-xs text-amber-400"
            >
              <Wrench className="w-3 h-3 animate-spin" />
              {tool.name}
            </span>
          ))}
        </div>
      )}
      
      {/* Reasoning preview with auto-scroll */}
      {reasoning && (
        <div 
          ref={reasoningRef}
          className="relative max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent"
        >
          <p className="text-sm text-zinc-400 italic whitespace-pre-wrap">
            {reasoning}
          </p>
        </div>
      )}
    </div>
  )
}

export function ChatPanel() {
  const { 
    currentRun, 
    sendMessage, 
    streamingMessage,
    streamingReasoning,
    currentIntent,
    activeTools
  } = useRun()
  const [input, setInput] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [selectedMention, setSelectedMention] = useState<AgentId | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentRun?.messages, streamingMessage, streamingReasoning, currentIntent, activeTools.size])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    // Extract mention from input (e.g., "@research")
    const mentionMatch = input.match(/^@(\w+)\s/)
    let mention: AgentId | undefined
    let content = input

    if (mentionMatch) {
      const agentName = mentionMatch[1].toLowerCase()
      const agent = AGENTS.find(a => a.id === agentName || a.name.toLowerCase() === agentName)
      if (agent) {
        mention = agent.id
        content = input.slice(mentionMatch[0].length)
      }
    } else if (selectedMention) {
      mention = selectedMention
    }

    sendMessage(content, mention)
    setInput('')
    setSelectedMention(null)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInput(value)

    // Show mentions dropdown when typing @
    if (value.endsWith('@')) {
      setShowMentions(true)
    } else if (!value.includes('@')) {
      setShowMentions(false)
    }
  }

  const handleMentionSelect = (agentId: AgentId) => {
    setSelectedMention(agentId)
    setShowMentions(false)
    setInput(input.replace(/@$/, ''))
    inputRef.current?.focus()
  }

  // Determine which agent is currently active (for inline thinking)
  const activeAgentId = currentIntent?.agentId || 
    streamingReasoning?.agentId || 
    streamingMessage?.agentId ||
    (activeTools.size > 0 ? Array.from(activeTools.values())[0].agentId : null)

  const isThinking = !!(currentIntent || streamingReasoning || activeTools.size > 0)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800">
        <h2 className="font-semibold">{currentRun?.topic || 'Chat'}</h2>
        <p className="text-sm text-zinc-500">
          Chat with your AI agents
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {currentRun?.messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        
        {/* Inline thinking indicator (like Claude) */}
        {isThinking && activeAgentId && !streamingMessage && (
          <ThinkingIndicator
            agentId={activeAgentId}
            intent={currentIntent?.intent}
            reasoning={streamingReasoning?.content}
            activeTools={activeTools}
          />
        )}
        
        {/* Streaming message */}
        {streamingMessage && (
          <ChatMessage 
            message={{
              id: 'streaming',
              role: 'agent',
              agentId: streamingMessage.agentId,
              content: streamingMessage.content,
              timestamp: new Date().toISOString(),
              isStreaming: true
            }} 
          />
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-zinc-800">
        {/* Selected mention indicator */}
        {selectedMention && (
          <div className="mb-2 flex items-center gap-2 text-sm">
            <span className="text-zinc-400">Sending to:</span>
            <span className={AGENTS.find(a => a.id === selectedMention)?.color}>
              @{selectedMention}
            </span>
            <button
              onClick={() => setSelectedMention(null)}
              className="text-zinc-500 hover:text-zinc-300"
            >
              ×
            </button>
          </div>
        )}

        {/* Mention dropdown */}
        {showMentions && (
          <div className="mb-2 bg-zinc-800 rounded-lg border border-zinc-700 overflow-hidden">
            {AGENTS.map((agent) => (
              <button
                key={agent.id}
                onClick={() => handleMentionSelect(agent.id)}
                className="w-full px-3 py-2 text-left hover:bg-zinc-700 flex items-center gap-2"
              >
                <AtSign className={`w-4 h-4 ${agent.color}`} />
                <span className={agent.color}>{agent.name}</span>
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Type a message... (use @ to mention an agent)"
            className="flex-1 px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-zinc-500"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  )
}
