import { PenTool, Copy, Check, Loader2, Linkedin } from 'lucide-react'
import { useState, useEffect } from 'react'
import { DraftData } from '../../../shared/types'
import { useRun } from '../../hooks/useRun'

interface DraftPanelProps {
  data: DraftData | null
  isLoading?: boolean
}

interface LinkedInStatus {
  connected: boolean
  userName: string | null
  configured: boolean
}

export function DraftPanel({ data, isLoading }: DraftPanelProps) {
  const { editPanel, currentRun } = useRun()
  const [copied, setCopied] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<{ success: boolean; message: string } | null>(null)
  const [linkedInStatus, setLinkedInStatus] = useState<LinkedInStatus | null>(null)

  // Check LinkedIn status on mount
  useEffect(() => {
    window.electron.invoke.linkedInStatus().then(setLinkedInStatus)
  }, [])

  const handleUpdate = (fullText: string) => {
    editPanel('draft', { 
      fullText,
      characterCount: fullText.length 
    })
  }

  const handleCopy = async () => {
    if (!data?.fullText) return
    await navigator.clipboard.writeText(data.fullText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleConnect = async () => {
    try {
      await window.electron.invoke.linkedInConnect()
      const status = await window.electron.invoke.linkedInStatus()
      setLinkedInStatus(status)
    } catch (err) {
      console.error('LinkedIn connect failed:', err)
    }
  }

  const handlePublish = async () => {
    if (!data?.fullText) return
    
    setPublishing(true)
    setPublishResult(null)
    
    try {
      const result = await window.electron.invoke.linkedInPublish({
        text: data.fullText,
        imageUrl: currentRun?.image?.url ?? undefined
      })
      
      if (result.success) {
        setPublishResult({ success: true, message: 'Published to LinkedIn! 🎉' })
      } else {
        setPublishResult({ success: false, message: result.error || 'Failed to publish' })
      }
    } catch (err) {
      setPublishResult({ success: false, message: err instanceof Error ? err.message : 'Failed to publish' })
    } finally {
      setPublishing(false)
    }
  }

  if (!data) {
    return (
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
          ) : (
            <PenTool className="w-4 h-4 text-amber-400" />
          )}
          <h3 className="font-medium text-amber-400">Draft</h3>
          {isLoading && (
            <span className="text-xs bg-amber-500/20 px-2 py-0.5 rounded-full text-amber-400 animate-pulse">
              Writing...
            </span>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-zinc-500">
            {isLoading ? (
              <>
                <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-amber-400" />
                <p className="text-sm">Writing draft...</p>
              </>
            ) : (
              <>
                <PenTool className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No draft yet</p>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
          ) : (
            <PenTool className="w-4 h-4 text-amber-400" />
          )}
          <h3 className="font-medium text-amber-400">Draft</h3>
          {isLoading && (
            <span className="text-xs bg-amber-500/20 px-2 py-0.5 rounded-full text-amber-400 animate-pulse">
              Improving...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${data.characterCount > 3000 ? 'text-red-400' : 'text-zinc-500'}`}>
            {data.characterCount}/3000
          </span>
          <button
            onClick={handleCopy}
            className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4 text-zinc-400" />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-4">
        <textarea
          value={data.fullText}
          onChange={(e) => handleUpdate(e.target.value)}
          className="w-full h-full bg-transparent resize-none focus:outline-none text-sm leading-relaxed placeholder-zinc-600"
          placeholder="Your LinkedIn post will appear here..."
        />
      </div>

      {/* Publish section */}
      <div className="px-4 py-3 border-t border-zinc-800">
        {publishResult && (
          <div className={`mb-2 text-sm ${publishResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
            {publishResult.message}
          </div>
        )}
        
        {linkedInStatus?.connected ? (
          <button
            onClick={handlePublish}
            disabled={publishing || !data.fullText}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {publishing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <Linkedin className="w-4 h-4" />
                Publish to LinkedIn
              </>
            )}
          </button>
        ) : linkedInStatus?.configured ? (
          <button
            onClick={handleConnect}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
          >
            <Linkedin className="w-4 h-4" />
            Connect LinkedIn to Publish
          </button>
        ) : (
          <div className="text-xs text-zinc-500 text-center">
            Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET to enable publishing
          </div>
        )}
      </div>
    </div>
  )
}
