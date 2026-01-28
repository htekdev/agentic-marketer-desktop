import { Message, AgentId } from '../../../shared/types'
import { User, Bot, Search, Globe, Lightbulb, PenTool, Image, ClipboardList, MessageCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

const AGENT_CONFIG: Record<AgentId, { name: string; color: string; bgColor: string; icon: typeof Bot }> = {
  conductor: { name: 'Conductor', color: 'text-indigo-400', bgColor: 'bg-indigo-500/20', icon: Bot },
  planner: { name: 'Planner', color: 'text-violet-400', bgColor: 'bg-violet-500/20', icon: ClipboardList },
  research: { name: 'Research', color: 'text-blue-400', bgColor: 'bg-blue-500/20', icon: Search },
  positioning: { name: 'Positioning', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', icon: Lightbulb },
  draft: { name: 'Draft', color: 'text-amber-400', bgColor: 'bg-amber-500/20', icon: PenTool },
  critic: { name: 'Critic', color: 'text-orange-400', bgColor: 'bg-orange-500/20', icon: MessageCircle },
  image: { name: 'Image', color: 'text-pink-400', bgColor: 'bg-pink-500/20', icon: Image },
}

interface ChatMessageProps {
  message: Message & { isStreaming?: boolean }
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isAgent = message.role === 'agent'
  const agentConfig = message.agentId ? AGENT_CONFIG[message.agentId] : null

  // Don't render empty messages
  if (!message.content?.trim() && !message.isStreaming) {
    return null
  }

  return (
    <div className={`flex gap-3 ${isAgent ? '' : 'flex-row-reverse'}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        isAgent 
          ? agentConfig?.bgColor || 'bg-zinc-700'
          : 'bg-zinc-700'
      }`}>
        {isAgent ? (
          agentConfig ? (
            <agentConfig.icon className={`w-4 h-4 ${agentConfig.color}`} />
          ) : (
            <Bot className="w-4 h-4 text-zinc-400" />
          )
        ) : (
          <User className="w-4 h-4 text-zinc-400" />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 ${isAgent ? '' : 'text-right'}`}>
        {/* Header */}
        {isAgent && agentConfig && (
          <div className={`text-sm font-medium mb-1 ${agentConfig.color}`}>
            {agentConfig.name}
          </div>
        )}

        {/* Message bubble */}
        <div className={`inline-block max-w-[85%] px-4 py-2 rounded-2xl ${
          isAgent 
            ? 'bg-zinc-800 text-zinc-100 rounded-tl-none'
            : 'bg-indigo-600 text-white rounded-tr-none'
        }`}>
          <div className="text-sm leading-relaxed prose prose-invert prose-sm max-w-none prose-p:my-1 prose-strong:text-white prose-em:text-zinc-300">
            <ReactMarkdown>
              {message.content}
            </ReactMarkdown>
            {message.isStreaming && (
              <span className="inline-flex ml-1">
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse-dot" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse-dot ml-0.5" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse-dot ml-0.5" style={{ animationDelay: '300ms' }} />
              </span>
            )}
          </div>
        </div>

        {/* Timestamp */}
        <div className="text-xs text-zinc-500 mt-1">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}
