import { Lightbulb, Users, Target, MessageSquare, Loader2 } from 'lucide-react'
import { PositioningData } from '../../../shared/types'
import { useRun } from '../../hooks/useRun'

interface PositioningPanelProps {
  data: PositioningData | null
  isLoading?: boolean
}

export function PositioningPanel({ data, isLoading }: PositioningPanelProps) {
  const { editPanel } = useRun()

  const handleUpdate = (field: keyof PositioningData, value: string | string[]) => {
    if (!data) return
    editPanel('positioning', { [field]: value })
  }

  if (!data) {
    return (
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
          ) : (
            <Lightbulb className="w-4 h-4 text-emerald-400" />
          )}
          <h3 className="font-medium text-emerald-400">Positioning</h3>
          {isLoading && (
            <span className="text-xs bg-emerald-500/20 px-2 py-0.5 rounded-full text-emerald-400 animate-pulse">
              Defining strategy...
            </span>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-zinc-500">
            {isLoading ? (
              <>
                <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-emerald-400" />
                <p className="text-sm">Defining positioning...</p>
              </>
            ) : (
              <>
                <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No positioning yet</p>
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
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-emerald-400" />
        <h3 className="font-medium text-emerald-400">Positioning</h3>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Angle */}
        <div>
          <label className="text-xs font-medium text-zinc-500 uppercase flex items-center gap-1 mb-1">
            <Target className="w-3 h-3" /> Angle
          </label>
          <input
            type="text"
            value={data.angle}
            onChange={(e) => handleUpdate('angle', e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Audience */}
        <div>
          <label className="text-xs font-medium text-zinc-500 uppercase flex items-center gap-1 mb-1">
            <Users className="w-3 h-3" /> Target Audience
          </label>
          <input
            type="text"
            value={data.audience}
            onChange={(e) => handleUpdate('audience', e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Pain Points */}
        {data.painPoints && data.painPoints.length > 0 && (
          <div>
            <label className="text-xs font-medium text-zinc-500 uppercase mb-1 block">
              Pain Points
            </label>
            <ul className="space-y-1">
              {data.painPoints.map((point, i) => (
                <li key={i} className="text-sm text-zinc-300 flex gap-2 items-center">
                  <span className="text-emerald-400">•</span>
                  <input
                    type="text"
                    value={point}
                    onChange={(e) => {
                      const newPoints = [...(data.painPoints || [])]
                      newPoints[i] = e.target.value
                      handleUpdate('painPoints', newPoints)
                    }}
                    className="flex-1 bg-transparent border-b border-zinc-700 focus:border-emerald-500 focus:outline-none py-1"
                  />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tone */}
        <div>
          <label className="text-xs font-medium text-zinc-500 uppercase flex items-center gap-1 mb-1">
            <MessageSquare className="w-3 h-3" /> Tone
          </label>
          <input
            type="text"
            value={data.tone}
            onChange={(e) => handleUpdate('tone', e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>
    </div>
  )
}
