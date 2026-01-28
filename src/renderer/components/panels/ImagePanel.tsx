import { Image as ImageIcon, RefreshCw, Download, AlertCircle, Loader2 } from 'lucide-react'
import { ImageData } from '../../../shared/types'
import { useRun } from '../../hooks/useRun'

interface ImagePanelProps {
  data: ImageData | null
  isLoading?: boolean
}

export function ImagePanel({ data, isLoading }: ImagePanelProps) {
  const { sendMessage } = useRun()

  const handleRegenerate = () => {
    sendMessage('Please regenerate the image for this post', 'image')
  }

  const handleDownload = () => {
    if (!data?.url) return
    
    const link = document.createElement('a')
    link.href = data.url
    link.download = 'linkedin-post-image.png'
    link.click()
  }

  // Show loading state from workflow phase
  const showLoading = isLoading || data?.status === 'generating'

  // Error state
  if (data?.status === 'error') {
    return (
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-pink-400" />
            <h3 className="font-medium text-pink-400">Image</h3>
          </div>
          <button
            onClick={handleRegenerate}
            className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
            title="Try again"
          >
            <RefreshCw className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-zinc-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-400" />
            <p className="text-sm text-red-400">Image generation failed</p>
            <p className="text-xs mt-1">Click refresh to try again</p>
          </div>
        </div>
      </div>
    )
  }

  if (!data || !data.url) {
    return (
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
          {showLoading ? (
            <Loader2 className="w-4 h-4 text-pink-400 animate-spin" />
          ) : (
            <ImageIcon className="w-4 h-4 text-pink-400" />
          )}
          <h3 className="font-medium text-pink-400">Image</h3>
          {showLoading && (
            <span className="text-xs bg-pink-500/20 px-2 py-0.5 rounded-full text-pink-400 animate-pulse">
              Generating...
            </span>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-zinc-500">
            {showLoading ? (
              <>
                <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-pink-400" />
                <p className="text-sm">Generating image...</p>
              </>
            ) : (
              <>
                <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No image yet</p>
                <p className="text-xs">Image will be generated automatically</p>
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
          <ImageIcon className="w-4 h-4 text-pink-400" />
          <h3 className="font-medium text-pink-400">Image</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRegenerate}
            className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
            title="Regenerate"
          >
            <RefreshCw className="w-4 h-4 text-zinc-400" />
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
            title="Download"
          >
            <Download className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
        <div className="relative max-w-full max-h-full">
          <img
            src={data.url}
            alt={data.altText || 'Generated image'}
            className="max-w-full max-h-[400px] object-contain rounded-lg"
          />
        </div>
      </div>

      {/* Alt text */}
      {data.altText && (
        <div className="px-4 py-2 border-t border-zinc-800">
          <p className="text-xs text-zinc-500 truncate" title={data.altText}>
            Alt: {data.altText}
          </p>
        </div>
      )}
    </div>
  )
}
