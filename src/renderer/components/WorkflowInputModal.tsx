// WorkflowInputModal - Handles all user interaction checkpoints in the workflow
// Supports: questions (planner), findings selection (research), improvements approval (critic)

import { useState } from 'react'
import { WorkflowPendingInput } from '../hooks/useRun'
import { UserInputResponse, ClarifyingQuestion, ResearchFinding, ImprovementSuggestion } from '../../shared/workflow-types'

interface WorkflowInputModalProps {
  pendingInput: WorkflowPendingInput
  onRespond: (response: UserInputResponse) => Promise<void>
  onCancel: () => Promise<void>
}

export function WorkflowInputModal({ pendingInput, onRespond, onCancel }: WorkflowInputModalProps) {
  const { phase, pendingInput: input } = pendingInput

  // Render based on input type
  switch (input.type) {
    case 'questions':
      return (
        <QuestionsModal
          questions={input.questions}
          onRespond={onRespond}
          onCancel={onCancel}
        />
      )
    case 'findings':
      return (
        <FindingsModal
          findings={input.findings}
          summary={input.summary}
          onRespond={onRespond}
          onCancel={onCancel}
        />
      )
    case 'improvements':
      return (
        <ImprovementsModal
          improvements={input.improvements}
          currentDraft={input.currentDraft}
          onRespond={onRespond}
          onCancel={onCancel}
        />
      )
    default:
      return null
  }
}

// Questions Modal (Planner phase)
function QuestionsModal({ 
  questions, 
  onRespond, 
  onCancel 
}: { 
  questions: ClarifyingQuestion[]
  onRespond: (response: UserInputResponse) => Promise<void>
  onCancel: () => Promise<void>
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [customInput, setCustomInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentQuestion = questions[currentIndex]
  const isLastQuestion = currentIndex === questions.length - 1
  const hasAllAnswers = questions.every(q => answers[q.id])

  const selectAnswer = (answer: string) => {
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: answer }))
    setCustomInput('')
    
    if (!isLastQuestion) {
      setTimeout(() => setCurrentIndex(prev => prev + 1), 300)
    }
  }

  const handleCustomSubmit = () => {
    if (customInput.trim()) {
      selectAnswer(customInput.trim())
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await onRespond({ type: 'questions', answers })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl shadow-2xl max-w-lg w-full border border-zinc-700">
        {/* Header */}
        <div className="p-4 border-b border-zinc-700">
          <div className="flex items-center gap-2">
            <span className="text-xl">📋</span>
            <h2 className="text-lg font-semibold">Planning Questions</h2>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Question {currentIndex + 1} of {questions.length}
          </p>
        </div>

        {/* Question */}
        <div className="p-4">
          <p className="text-lg mb-4">{currentQuestion.question}</p>

          {/* Options */}
          {currentQuestion.options && currentQuestion.options.length > 0 && (
            <div className="space-y-2 mb-4">
              {currentQuestion.options.map((option, i) => (
                <button
                  key={i}
                  onClick={() => selectAnswer(option)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    answers[currentQuestion.id] === option
                      ? 'border-indigo-500 bg-indigo-500/20'
                      : 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          {/* Custom input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
              placeholder="Or type your own answer..."
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
            {customInput && (
              <button
                onClick={handleCustomSubmit}
                className="px-3 py-2 bg-zinc-700 rounded-lg hover:bg-zinc-600 text-sm"
              >
                Use
              </button>
            )}
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 mt-4">
            {questions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => setCurrentIndex(i)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === currentIndex
                    ? 'bg-indigo-500'
                    : answers[q.id]
                    ? 'bg-green-500'
                    : 'bg-zinc-600'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-700 flex justify-between">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
          >
            Skip Planning
          </button>
          <button
            onClick={handleSubmit}
            disabled={!hasAllAnswers || isSubmitting}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Processing...' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Findings Modal (Research phase)
function FindingsModal({ 
  findings, 
  summary,
  onRespond, 
  onCancel 
}: { 
  findings: ResearchFinding[]
  summary: string
  onRespond: (response: UserInputResponse) => Promise<void>
  onCancel: () => Promise<void>
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(findings.map(f => f.id)))
  const [isSubmitting, setIsSubmitting] = useState(false)

  const toggleFinding = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await onRespond({ type: 'findings', selectedIds: Array.from(selectedIds) })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl shadow-2xl max-w-2xl w-full border border-zinc-700 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-zinc-700">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔍</span>
            <h2 className="text-lg font-semibold">Research Findings</h2>
          </div>
          <p className="text-sm text-zinc-400 mt-1">{summary}</p>
        </div>

        {/* Findings list */}
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-sm text-zinc-400 mb-3">
            Select the insights you want to include in your post:
          </p>
          <div className="space-y-3">
            {findings.map((finding) => (
              <button
                key={finding.id}
                onClick={() => toggleFinding(finding.id)}
                className={`w-full text-left p-4 rounded-lg border transition-colors ${
                  selectedIds.has(finding.id)
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center ${
                    selectedIds.has(finding.id) 
                      ? 'bg-indigo-500 border-indigo-500' 
                      : 'border-zinc-600'
                  }`}>
                    {selectedIds.has(finding.id) && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">{finding.title}</h3>
                    <p className="text-sm text-zinc-400 mt-1">{finding.summary}</p>
                    {finding.source && (
                      <p className="text-xs text-zinc-500 mt-2">Source: {finding.source}</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-700 flex justify-between">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
          >
            Skip Research
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-400">
              {selectedIds.size} of {findings.length} selected
            </span>
            <button
              onClick={handleSubmit}
              disabled={selectedIds.size === 0 || isSubmitting}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Processing...' : 'Continue with Selected'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Improvements Modal (Critic phase)
function ImprovementsModal({ 
  improvements, 
  currentDraft,
  onRespond, 
  onCancel 
}: { 
  improvements: ImprovementSuggestion[]
  currentDraft: string
  onRespond: (response: UserInputResponse) => Promise<void>
  onCancel: () => Promise<void>
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(improvements.filter(i => i.impact === 'high').map(i => i.id))
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  const toggleImprovement = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await onRespond({ type: 'improvements', selectedIds: Array.from(selectedIds) })
    } finally {
      setIsSubmitting(false)
    }
  }

  const impactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-red-400 bg-red-400/10'
      case 'medium': return 'text-yellow-400 bg-yellow-400/10'
      case 'low': return 'text-green-400 bg-green-400/10'
      default: return 'text-zinc-400 bg-zinc-400/10'
    }
  }

  const categoryIcon = (category: string) => {
    switch (category) {
      case 'hook': return '🎣'
      case 'body': return '📝'
      case 'credibility': return '📊'
      case 'cta': return '👆'
      case 'tone': return '🎭'
      case 'structure': return '🏗️'
      default: return '✨'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl shadow-2xl max-w-3xl w-full border border-zinc-700 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-zinc-700">
          <div className="flex items-center gap-2">
            <span className="text-xl">✍️</span>
            <h2 className="text-lg font-semibold">Suggested Improvements</h2>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Review and select the improvements you want to apply to your draft
          </p>
        </div>

        {/* Improvements list */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {improvements.map((improvement) => (
              <button
                key={improvement.id}
                onClick={() => toggleImprovement(improvement.id)}
                className={`w-full text-left p-4 rounded-lg border transition-colors ${
                  selectedIds.has(improvement.id)
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center ${
                    selectedIds.has(improvement.id) 
                      ? 'bg-indigo-500 border-indigo-500' 
                      : 'border-zinc-600'
                  }`}>
                    {selectedIds.has(improvement.id) && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span>{categoryIcon(improvement.category)}</span>
                      <span className="font-medium capitalize">{improvement.category}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${impactColor(improvement.impact)}`}>
                        {improvement.impact} impact
                      </span>
                    </div>
                    <p className="text-sm text-zinc-300">{improvement.description}</p>
                    
                    {improvement.currentText && improvement.suggestedText && (
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="p-2 bg-red-500/10 rounded border border-red-500/20">
                          <span className="text-red-400 text-xs font-medium">Current:</span>
                          <p className="text-zinc-400 mt-1">{improvement.currentText}</p>
                        </div>
                        <div className="p-2 bg-green-500/10 rounded border border-green-500/20">
                          <span className="text-green-400 text-xs font-medium">Suggested:</span>
                          <p className="text-zinc-300 mt-1">{improvement.suggestedText}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-700 flex justify-between">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
          >
            Keep Original Draft
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-400">
              {selectedIds.size} improvement{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Applying...' : selectedIds.size > 0 ? 'Apply Selected' : 'Continue Without Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
