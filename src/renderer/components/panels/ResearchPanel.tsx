import { Search, ExternalLink, X, Plus, MessageSquareQuote, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { ResearchData } from '../../../shared/types'
import { useRun } from '../../hooks/useRun'

interface ResearchPanelProps {
  data: ResearchData
  isLoading?: boolean
}

export function ResearchPanel({ data, isLoading }: ResearchPanelProps) {
  const { editPanel } = useRun()
  const [newUrl, setNewUrl] = useState('')
  const [newClaim, setNewClaim] = useState('')

  const handleRemoveSource = (id: string) => {
    editPanel('research', {
      sources: data.sources.filter(s => s.id !== id)
    })
  }

  const handleRemoveClaim = (index: number) => {
    editPanel('research', {
      claims: data.claims.filter((_, i) => i !== index)
    })
  }

  const handleAddSource = () => {
    if (!newUrl.trim()) return
    
    editPanel('research', {
      sources: [
        ...data.sources,
        {
          id: crypto.randomUUID(),
          url: newUrl,
          title: newUrl,
          content: '',
          addedAt: new Date().toISOString()
        }
      ]
    })
    setNewUrl('')
  }

  const handleAddClaim = () => {
    if (!newClaim.trim()) return
    
    editPanel('research', {
      claims: [...(data.claims || []), newClaim]
    })
    setNewClaim('')
  }

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
        {isLoading ? (
          <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
        ) : (
          <Search className="w-4 h-4 text-blue-400" />
        )}
        <h3 className="font-medium text-blue-400">Research</h3>
        {isLoading ? (
          <span className="text-xs bg-blue-500/20 px-2 py-0.5 rounded-full text-blue-400 animate-pulse">
            Researching...
          </span>
        ) : (
          <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-400">
            {data.sources.length} sources
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Claims Section */}
        <div>
          <h4 className="text-xs font-medium text-zinc-500 uppercase mb-2 flex items-center gap-1">
            <MessageSquareQuote className="w-3 h-3" />
            Claims to Support
          </h4>
          {(data.claims || []).length > 0 ? (
            <ul className="space-y-2">
              {data.claims.map((claim, i) => (
                <li key={i} className="group bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 flex items-start gap-2">
                  <span className="text-sm text-blue-300 flex-1">{claim}</span>
                  <button
                    onClick={() => handleRemoveClaim(i)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-700 rounded transition-all"
                  >
                    <X className="w-3 h-3 text-zinc-500" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500 italic">No claims defined yet</p>
          )}
          
          {/* Add Claim Input */}
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={newClaim}
              onChange={(e) => setNewClaim(e.target.value)}
              placeholder="Add a claim to support..."
              className="flex-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-zinc-500"
              onKeyDown={(e) => e.key === 'Enter' && handleAddClaim()}
            />
            <button
              onClick={handleAddClaim}
              disabled={!newClaim.trim()}
              className="p-1 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Sources */}
        <div>
          <h4 className="text-xs font-medium text-zinc-500 uppercase mb-2">Sources</h4>
          {data.sources.length > 0 ? (
            <div className="space-y-2">
              {data.sources.map((source, index) => (
                <div
                  key={source.id || `source-${index}`}
                  className="group bg-zinc-800/50 rounded-lg p-3 hover:bg-zinc-800 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{source.title}</h4>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-zinc-500 hover:text-blue-400 flex items-center gap-1 truncate"
                      >
                        {source.url}
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>
                    <button
                      onClick={() => handleRemoveSource(source.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-700 rounded transition-all"
                    >
                      <X className="w-4 h-4 text-zinc-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-zinc-500 py-4">
              <Search className="w-6 h-6 mx-auto mb-1 opacity-50" />
              <p className="text-xs">No sources yet</p>
            </div>
          )}
        </div>

        {/* Facts */}
        {data.facts.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-zinc-500 uppercase mb-2">Key Facts</h4>
            <ul className="space-y-1">
              {data.facts.map((fact, i) => (
                <li key={i} className="text-sm text-zinc-300 flex gap-2">
                  <span className="text-blue-400">•</span>
                  {fact}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Add Source */}
      <div className="p-3 border-t border-zinc-800">
        <div className="flex gap-2">
          <input
            type="url"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="Add URL..."
            className="flex-1 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-zinc-500"
            onKeyDown={(e) => e.key === 'Enter' && handleAddSource()}
          />
          <button
            onClick={handleAddSource}
            disabled={!newUrl.trim()}
            className="p-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
