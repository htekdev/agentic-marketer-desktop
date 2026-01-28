import { useState, useEffect } from 'react'
import { X, Cpu, GitBranch, Users } from 'lucide-react'

type OrchestrationMode = 'pipeline' | 'single-agent' | 'supervisor'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

const MODE_INFO: Record<OrchestrationMode, { 
  name: string
  description: string
  icon: React.ReactNode
  available: boolean 
}> = {
  'pipeline': {
    name: 'Pipeline',
    description: 'Sequential phases: Plan → Research → Position → Draft → Critic → Image. Each phase has a specialized agent.',
    icon: <GitBranch className="w-5 h-5" />,
    available: true
  },
  'single-agent': {
    name: 'Single Agent',
    description: 'One intelligent agent with all tools. More flexible, decides its own workflow based on the task.',
    icon: <Cpu className="w-5 h-5" />,
    available: true
  },
  'supervisor': {
    name: 'Supervisor',
    description: 'A coordinator agent that delegates to specialist agents dynamically. (Coming soon)',
    icon: <Users className="w-5 h-5" />,
    available: false
  }
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [currentMode, setCurrentMode] = useState<OrchestrationMode>('pipeline')
  const [isLoading, setIsLoading] = useState(false)
  const [linkedInStatus, setLinkedInStatus] = useState<{ connected: boolean; userName: string | null }>({ 
    connected: false, 
    userName: null 
  })

  useEffect(() => {
    if (isOpen) {
      // Fetch current mode
      window.electron.invoke.getOrchestrationMode().then(({ mode }) => {
        setCurrentMode(mode)
      })
      // Fetch LinkedIn status
      window.electron.invoke.linkedInStatus().then((status) => {
        setLinkedInStatus({ connected: status.connected, userName: status.userName })
      })
    }
  }, [isOpen])

  const handleModeChange = async (mode: OrchestrationMode) => {
    if (!MODE_INFO[mode].available || mode === currentMode) return
    
    setIsLoading(true)
    try {
      await window.electron.invoke.setOrchestrationMode(mode)
      setCurrentMode(mode)
    } catch (err) {
      console.error('Failed to change mode:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLinkedInConnect = async () => {
    try {
      await window.electron.invoke.linkedInConnect()
      const status = await window.electron.invoke.linkedInStatus()
      setLinkedInStatus({ connected: status.connected, userName: status.userName })
    } catch (err) {
      console.error('LinkedIn connect error:', err)
    }
  }

  const handleLinkedInDisconnect = async () => {
    try {
      await window.electron.invoke.linkedInDisconnect()
      setLinkedInStatus({ connected: false, userName: null })
    } catch (err) {
      console.error('LinkedIn disconnect error:', err)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Orchestration Mode */}
          <div>
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Agent Orchestration Mode</h3>
            <div className="space-y-2">
              {(Object.entries(MODE_INFO) as [OrchestrationMode, typeof MODE_INFO['pipeline']][]).map(([mode, info]) => (
                <button
                  key={mode}
                  onClick={() => handleModeChange(mode)}
                  disabled={!info.available || isLoading}
                  className={`w-full p-3 rounded-lg border text-left transition-all ${
                    currentMode === mode
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : info.available
                        ? 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/50'
                        : 'border-zinc-800 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`${currentMode === mode ? 'text-indigo-400' : 'text-zinc-500'}`}>
                      {info.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{info.name}</span>
                        {currentMode === mode && (
                          <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded">
                            Active
                          </span>
                        )}
                        {!info.available && (
                          <span className="text-xs bg-zinc-700 text-zinc-400 px-2 py-0.5 rounded">
                            Coming Soon
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-500 mt-1">{info.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* LinkedIn Connection */}
          <div>
            <h3 className="text-sm font-medium text-zinc-400 mb-3">LinkedIn</h3>
            <div className="p-3 rounded-lg border border-zinc-700 bg-zinc-800/30">
              {linkedInStatus.connected ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Connected</p>
                    <p className="text-sm text-zinc-500">{linkedInStatus.userName}</p>
                  </div>
                  <button
                    onClick={handleLinkedInDisconnect}
                    className="px-3 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-zinc-500">Not connected</p>
                  <button
                    onClick={handleLinkedInConnect}
                    className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
                  >
                    Connect
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
