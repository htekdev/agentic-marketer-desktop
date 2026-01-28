import { Plus, MessageSquare, Settings, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useRun } from '../hooks/useRun'
import { SettingsModal } from './SettingsModal'

export function Sidebar() {
  const { runs, currentRun, loadRun, startNewChat } = useRun()
  const [showSettings, setShowSettings] = useState(false)

  return (
    <>
      <aside className="w-16 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center py-4 gap-2">
        {/* Logo */}
        <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center mb-4">
          <Sparkles className="w-5 h-5" />
        </div>

        {/* New Chat */}
        <button
          onClick={startNewChat}
          className="w-10 h-10 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors"
          title="New Chat"
        >
          <Plus className="w-5 h-5" />
        </button>

        {/* Run History */}
        <div className="flex-1 overflow-y-auto w-full px-3">
          {runs.slice(0, 10).map((run) => (
            <button
              key={run.id}
              onClick={() => loadRun(run.id)}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors mb-2 ${
                currentRun?.id === run.id
                  ? 'bg-indigo-600/20 text-indigo-400'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
              }`}
              title={run.topic}
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          ))}
        </div>

        {/* Settings */}
        <button
          onClick={() => setShowSettings(true)}
          className="w-10 h-10 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors"
          title="Settings"
        >
          <Settings className="w-5 h-5 text-zinc-400" />
        </button>
      </aside>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>
  )
}
