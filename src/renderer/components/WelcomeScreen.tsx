import { Sparkles, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { useRun } from '../hooks/useRun'

export function WelcomeScreen() {
  const [topic, setTopic] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const { createRun } = useRun()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic.trim() || isCreating) return
    
    setIsCreating(true)
    try {
      await createRun(topic.trim())
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-lg w-full text-center">
        {/* Logo */}
        <div className="w-20 h-20 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto mb-6">
          <Sparkles className="w-10 h-10" />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold mb-2">Agentic Marketer</h1>
        <p className="text-zinc-400 mb-8">
          Create compelling LinkedIn posts with AI agents that research, position, draft, and design.
        </p>

        {/* New Run Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What would you like to post about?"
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-zinc-500"
              autoFocus
            />
          </div>
          
          <button
            type="submit"
            disabled={!topic.trim() || isCreating}
            className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
          >
            {isCreating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                Start Creating
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick Examples */}
        <div className="mt-8">
          <p className="text-sm text-zinc-500 mb-3">Try these topics:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {[
              'Platform engineering trends',
              'AI in DevOps',
              'Remote work productivity',
              'Leadership lessons'
            ].map((example) => (
              <button
                key={example}
                onClick={() => setTopic(example)}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-full text-sm text-zinc-300 transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
