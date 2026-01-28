import { useState } from 'react'
import { X, Check, MessageCircle, Lightbulb, Search, Sparkles } from 'lucide-react'
import { AgentQuestion, AgentReviewRequest, Improvement } from '../../shared/types'

interface AgentQuestionModalProps {
  question: AgentQuestion | AgentReviewRequest
  onRespond: (response: { answer?: string; selectedIds?: string[] }) => void
  onCancel: () => void
}

export function AgentQuestionModal({ question, onRespond, onCancel }: AgentQuestionModalProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [customAnswer, setCustomAnswer] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Check if this is a review request (multi-select) or a question (single select)
  const isReviewRequest = 'type' in question && (question.type === 'review_improvements' || question.type === 'review_research')

  const handleSubmit = () => {
    if (isReviewRequest) {
      onRespond({ selectedIds: Array.from(selectedIds) })
    } else {
      const answer = customAnswer.trim() || selectedOption
      if (answer) {
        onRespond({ answer })
      }
    }
  }

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const selectAll = () => {
    if (isReviewRequest && 'improvements' in question && question.improvements) {
      setSelectedIds(new Set(question.improvements.map((i: Improvement) => i.id)))
    } else if (isReviewRequest && 'researchFindings' in question && question.researchFindings) {
      setSelectedIds(new Set(question.researchFindings.map((f: { id: string }) => f.id)))
    }
  }

  // Get icon based on agent
  const getIcon = () => {
    if (question.agentId === 'research') return <Search className="w-5 h-5 text-blue-400" />
    if (question.agentId === 'critic') return <Lightbulb className="w-5 h-5 text-amber-400" />
    return <MessageCircle className="w-5 h-5 text-indigo-400" />
  }

  // Render single question (Planner)
  if (!isReviewRequest) {
    const q = question as AgentQuestion
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-zinc-900 rounded-xl border border-zinc-700 max-w-lg w-full shadow-2xl">
          {/* Header */}
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getIcon()}
              <span className="font-medium">Quick Question</span>
            </div>
            <button onClick={onCancel} className="p-1 hover:bg-zinc-800 rounded-lg">
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          </div>

          {/* Question */}
          <div className="p-6">
            <p className="text-lg mb-4">{q.question}</p>

            {/* Options */}
            <div className="space-y-2">
              {q.options.map((option: string, i: number) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedOption(option)
                    setCustomAnswer('')
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                    selectedOption === option
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            {/* Custom answer */}
            {q.allowCustom !== false && (
              <div className="mt-4">
                <input
                  type="text"
                  placeholder="Or type your own answer..."
                  value={customAnswer}
                  onChange={(e) => {
                    setCustomAnswer(e.target.value)
                    setSelectedOption(null)
                  }}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-zinc-800 flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Skip
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedOption && !customAnswer.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Continue
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Render review request (Research findings or Critic improvements)
  const reviewReq = question as AgentReviewRequest

  if (reviewReq.type === 'review_improvements' && reviewReq.improvements) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-zinc-900 rounded-xl border border-zinc-700 max-w-2xl w-full shadow-2xl max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <Lightbulb className="w-5 h-5 text-amber-400" />
              <span className="font-medium">Review Suggested Improvements</span>
            </div>
            <button onClick={onCancel} className="p-1 hover:bg-zinc-800 rounded-lg">
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto flex-1">
            <p className="text-zinc-400 mb-4">Select the improvements you'd like to apply:</p>

            <div className="space-y-3">
              {reviewReq.improvements.map((improvement: Improvement) => (
                <div
                  key={improvement.id}
                  onClick={() => toggleSelection(improvement.id)}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedIds.has(improvement.id)
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 ${
                      selectedIds.has(improvement.id) 
                        ? 'border-emerald-500 bg-emerald-500' 
                        : 'border-zinc-600'
                    }`}>
                      {selectedIds.has(improvement.id) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs uppercase tracking-wide text-zinc-500">{improvement.category}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          improvement.impact === 'high' ? 'bg-red-500/20 text-red-400' :
                          improvement.impact === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-zinc-700 text-zinc-400'
                        }`}>
                          {improvement.impact} impact
                        </span>
                      </div>
                      <p className="text-sm">{improvement.description}</p>
                      {improvement.suggestedText && (
                        <p className="mt-2 text-xs text-emerald-400 bg-emerald-500/10 p-2 rounded">
                          → {improvement.suggestedText}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-zinc-800 flex justify-between shrink-0">
            <button
              onClick={selectAll}
              className="text-sm text-indigo-400 hover:text-indigo-300"
            >
              Select all
            </button>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Skip all
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Apply {selectedIds.size} improvement{selectedIds.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Research findings review
  if (reviewReq.type === 'review_research' && reviewReq.researchFindings) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-zinc-900 rounded-xl border border-zinc-700 max-w-2xl w-full shadow-2xl max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <Search className="w-5 h-5 text-blue-400" />
              <span className="font-medium">Choose Your Focus Areas</span>
            </div>
            <button onClick={onCancel} className="p-1 hover:bg-zinc-800 rounded-lg">
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto flex-1">
            <p className="text-zinc-400 mb-4">I found these interesting angles. Select the ones you want to focus on:</p>

            <div className="space-y-3">
              {reviewReq.researchFindings.map((finding: { id: string; title: string; summary: string; source?: string }) => (
                <div
                  key={finding.id}
                  onClick={() => toggleSelection(finding.id)}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedIds.has(finding.id)
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 ${
                      selectedIds.has(finding.id) 
                        ? 'border-blue-500 bg-blue-500' 
                        : 'border-zinc-600'
                    }`}>
                      {selectedIds.has(finding.id) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium mb-1">{finding.title}</h4>
                      <p className="text-sm text-zinc-400">{finding.summary}</p>
                      {finding.source && (
                        <p className="mt-1 text-xs text-zinc-500">Source: {finding.source}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-zinc-800 flex justify-between shrink-0">
            <button
              onClick={selectAll}
              className="text-sm text-indigo-400 hover:text-indigo-300"
            >
              Select all
            </button>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Use all findings
              </button>
              <button
                onClick={handleSubmit}
                disabled={selectedIds.size === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Focus on {selectedIds.size} topic{selectedIds.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
