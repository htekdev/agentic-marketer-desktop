import { useState, useEffect } from 'react'
import { X, Cpu, GitBranch, Users, Key, Eye, EyeOff, Check, AlertCircle, Loader2 } from 'lucide-react'

type OrchestrationMode = 'pipeline' | 'single-agent' | 'supervisor'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ApiKeyStatus {
  openaiApiKey: boolean
  exaApiKey: boolean
  linkedinClientId: boolean
  linkedinClientSecret: boolean
}

interface CopilotStatus {
  available: boolean
  error?: string
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
  
  // API Keys state
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>({
    openaiApiKey: false,
    exaApiKey: false,
    linkedinClientId: false,
    linkedinClientSecret: false
  })
  const [copilotStatus, setCopilotStatus] = useState<CopilotStatus>({ available: false })
  
  // Edit state for API keys
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [keyValue, setKeyValue] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<{ valid: boolean; error?: string } | null>(null)

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
      // Fetch API key status
      window.electron.invoke.getApiKeyStatus().then(setApiKeyStatus)
      // Fetch Copilot status
      window.electron.invoke.getCopilotStatus().then(setCopilotStatus)
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

  const handleSaveApiKey = async (keyName: string) => {
    if (!keyValue.trim()) return
    
    // Validate if it's OpenAI or Exa key
    if (keyName === 'openaiApiKey' || keyName === 'exaApiKey') {
      setValidating(true)
      setValidationResult(null)
      const result = await window.electron.invoke.validateApiKey(
        keyName === 'openaiApiKey' ? 'openai' : 'exa',
        keyValue
      )
      setValidating(false)
      setValidationResult(result)
      
      if (!result.valid) return
    }
    
    // Save the key
    await window.electron.invoke.setApiKeys({ [keyName]: keyValue })
    
    // Refresh status
    const status = await window.electron.invoke.getApiKeyStatus()
    setApiKeyStatus(status)
    
    // Reset edit state
    setEditingKey(null)
    setKeyValue('')
    setShowKey(false)
    setValidationResult(null)
  }

  const handleCancelEdit = () => {
    setEditingKey(null)
    setKeyValue('')
    setShowKey(false)
    setValidationResult(null)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 sticky top-0 bg-zinc-900">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Copilot Status */}
          <div>
            <h3 className="text-sm font-medium text-zinc-400 mb-3">GitHub Copilot</h3>
            <div className={`p-3 rounded-lg border ${copilotStatus.available ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-red-500/50 bg-red-500/10'}`}>
              <div className="flex items-center gap-2">
                {copilotStatus.available ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">Connected</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <span className="text-red-400">Not Available</span>
                  </>
                )}
              </div>
              {copilotStatus.error && (
                <p className="mt-2 text-sm text-red-300">{copilotStatus.error}</p>
              )}
              {!copilotStatus.available && (
                <p className="mt-2 text-xs text-zinc-400">
                  Ensure you have GitHub Copilot CLI installed and are logged in.
                </p>
              )}
            </div>
          </div>

          {/* API Keys */}
          <div>
            <h3 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
              <Key className="w-4 h-4" />
              API Keys
            </h3>
            <div className="space-y-3">
              {/* OpenAI API Key */}
              <ApiKeyInput
                label="OpenAI API Key"
                description="Required for image generation"
                isConfigured={apiKeyStatus.openaiApiKey}
                isEditing={editingKey === 'openaiApiKey'}
                value={keyValue}
                showValue={showKey}
                validating={validating}
                validationResult={editingKey === 'openaiApiKey' ? validationResult : null}
                onEdit={() => { setEditingKey('openaiApiKey'); setKeyValue(''); setValidationResult(null); }}
                onChange={setKeyValue}
                onToggleShow={() => setShowKey(!showKey)}
                onSave={() => handleSaveApiKey('openaiApiKey')}
                onCancel={handleCancelEdit}
              />
              
              {/* Exa API Key */}
              <ApiKeyInput
                label="Exa API Key"
                description="Required for web research"
                isConfigured={apiKeyStatus.exaApiKey}
                isEditing={editingKey === 'exaApiKey'}
                value={keyValue}
                showValue={showKey}
                validating={validating}
                validationResult={editingKey === 'exaApiKey' ? validationResult : null}
                onEdit={() => { setEditingKey('exaApiKey'); setKeyValue(''); setValidationResult(null); }}
                onChange={setKeyValue}
                onToggleShow={() => setShowKey(!showKey)}
                onSave={() => handleSaveApiKey('exaApiKey')}
                onCancel={handleCancelEdit}
              />
            </div>
          </div>

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
              ) : apiKeyStatus.linkedinClientId && apiKeyStatus.linkedinClientSecret ? (
                <div className="flex items-center justify-between">
                  <p className="text-zinc-500">Not connected</p>
                  <button
                    onClick={handleLinkedInConnect}
                    className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
                  >
                    Connect
                  </button>
                </div>
              ) : (
                <div className="text-center py-2">
                  <p className="text-zinc-500 text-sm">LinkedIn credentials not configured</p>
                  <button
                    onClick={() => { setEditingKey('linkedinClientId'); setKeyValue(''); }}
                    className="mt-2 text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    Configure LinkedIn (Advanced)
                  </button>
                </div>
              )}
            </div>
            
            {/* LinkedIn Advanced Settings */}
            {(editingKey === 'linkedinClientId' || editingKey === 'linkedinClientSecret') && (
              <div className="mt-3 p-3 rounded-lg border border-zinc-700 bg-zinc-800/30 space-y-3">
                <p className="text-xs text-zinc-400">
                  Get these from <a href="https://developer.linkedin.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">LinkedIn Developer Portal</a>
                </p>
                <ApiKeyInput
                  label="Client ID"
                  isConfigured={apiKeyStatus.linkedinClientId}
                  isEditing={editingKey === 'linkedinClientId'}
                  value={keyValue}
                  showValue={true}
                  onEdit={() => { setEditingKey('linkedinClientId'); setKeyValue(''); }}
                  onChange={setKeyValue}
                  onSave={() => handleSaveApiKey('linkedinClientId')}
                  onCancel={handleCancelEdit}
                />
                <ApiKeyInput
                  label="Client Secret"
                  isConfigured={apiKeyStatus.linkedinClientSecret}
                  isEditing={editingKey === 'linkedinClientSecret'}
                  value={keyValue}
                  showValue={showKey}
                  onEdit={() => { setEditingKey('linkedinClientSecret'); setKeyValue(''); }}
                  onChange={setKeyValue}
                  onToggleShow={() => setShowKey(!showKey)}
                  onSave={() => handleSaveApiKey('linkedinClientSecret')}
                  onCancel={handleCancelEdit}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// API Key Input Component
function ApiKeyInput({
  label,
  description,
  isConfigured,
  isEditing,
  value,
  showValue,
  validating,
  validationResult,
  onEdit,
  onChange,
  onToggleShow,
  onSave,
  onCancel
}: {
  label: string
  description?: string
  isConfigured: boolean
  isEditing: boolean
  value: string
  showValue: boolean
  validating?: boolean
  validationResult?: { valid: boolean; error?: string } | null
  onEdit: () => void
  onChange: (value: string) => void
  onToggleShow?: () => void
  onSave: () => void
  onCancel: () => void
}) {
  if (isEditing) {
    return (
      <div className="p-3 rounded-lg border border-indigo-500/50 bg-indigo-500/5">
        <label className="text-sm font-medium">{label}</label>
        <div className="mt-2 flex gap-2">
          <div className="flex-1 relative">
            <input
              type={showValue ? 'text' : 'password'}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={`Enter ${label}...`}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              autoFocus
            />
            {onToggleShow && (
              <button
                onClick={onToggleShow}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-300"
              >
                {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            )}
          </div>
          <button
            onClick={onSave}
            disabled={!value.trim() || validating}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg text-sm flex items-center gap-1"
          >
            {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm"
          >
            Cancel
          </button>
        </div>
        {validationResult && !validationResult.valid && (
          <p className="mt-2 text-sm text-red-400">{validationResult.error}</p>
        )}
      </div>
    )
  }

  return (
    <div className="p-3 rounded-lg border border-zinc-700 bg-zinc-800/30">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">{label}</p>
          {description && <p className="text-xs text-zinc-500">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {isConfigured ? (
            <>
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <Check className="w-3 h-3" /> Configured
              </span>
              <button
                onClick={onEdit}
                className="text-xs text-zinc-400 hover:text-zinc-300"
              >
                Change
              </button>
            </>
          ) : (
            <button
              onClick={onEdit}
              className="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 rounded transition-colors"
            >
              Configure
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
