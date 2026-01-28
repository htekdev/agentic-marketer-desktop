import { RunProvider, useRun } from './hooks/useRun'
import { Sidebar } from './components/Sidebar'
import { ChatPanel } from './components/chat/ChatPanel'
import { PanelGrid } from './components/panels/PanelGrid'
import { WelcomeScreen } from './components/WelcomeScreen'
import { WorkflowInputModal } from './components/WorkflowInputModal'

function AppContent() {
  const { 
    currentRun, 
    workflowPendingInput, 
    respondToWorkflow, 
    dismissWorkflowInput 
  } = useRun()

  if (!currentRun) {
    return <WelcomeScreen />
  }

  return (
    <>
      <div className="flex h-full">
        {/* Chat Panel - Left Side */}
        <div className="w-[400px] min-w-[350px] border-r border-zinc-800 flex flex-col">
          <ChatPanel />
        </div>

        {/* Domain Panels - Right Side */}
        <div className="flex-1 overflow-hidden">
          <PanelGrid />
        </div>
      </div>

      {/* Workflow Input Modal (new state machine) */}
      {workflowPendingInput && (
        <WorkflowInputModal
          pendingInput={workflowPendingInput}
          onRespond={respondToWorkflow}
          onCancel={dismissWorkflowInput}
        />
      )}
    </>
  )
}

function App() {
  return (
    <RunProvider>
      <div className="h-screen bg-zinc-950 text-zinc-100 flex">
        {/* Sidebar */}
        <Sidebar />
        
        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <AppContent />
        </main>
      </div>
    </RunProvider>
  )
}

export default App
