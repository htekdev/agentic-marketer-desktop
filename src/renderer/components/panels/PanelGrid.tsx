import { useRun } from '../../hooks/useRun'
import { ResearchPanel } from './ResearchPanel'
import { PositioningPanel } from './PositioningPanel'
import { DraftPanel } from './DraftPanel'
import { ImagePanel } from './ImagePanel'

export function PanelGrid() {
  const { currentRun, workflowPhase } = useRun()

  if (!currentRun) return null

  return (
    <div className="h-full grid grid-cols-2 grid-rows-2 gap-4 p-4 overflow-hidden">
      <ResearchPanel data={currentRun.research} isLoading={workflowPhase === 'research'} />
      <PositioningPanel data={currentRun.positioning} isLoading={workflowPhase === 'positioning'} />
      <DraftPanel data={currentRun.draft} isLoading={workflowPhase === 'draft' || workflowPhase === 'critic'} />
      <ImagePanel data={currentRun.image} isLoading={workflowPhase === 'image'} />
    </div>
  )
}
