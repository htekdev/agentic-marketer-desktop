import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { RunState } from '../../shared/types'

// Get the data directory path
function getDataDir(): string {
  const userDataPath = app.getPath('userData')
  const dataDir = join(userDataPath, 'runs')
  
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
  
  return dataDir
}

function getRunPath(runId: string): string {
  return join(getDataDir(), `${runId}.json`)
}

export async function createRun(topic: string): Promise<RunState> {
  const run: RunState = {
    id: crypto.randomUUID(),
    topic,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
    research: {
      sources: [],
      facts: [],
      claims: []
    },
    positioning: null,
    draft: null,
    image: null
  }

  await saveRun(run)
  return run
}

export async function getRun(runId: string): Promise<RunState | null> {
  const path = getRunPath(runId)
  
  if (!existsSync(path)) {
    return null
  }

  try {
    const data = readFileSync(path, 'utf-8')
    return JSON.parse(data) as RunState
  } catch (error) {
    console.error(`Failed to read run ${runId}:`, error)
    return null
  }
}

export async function updateRun(runOrId: RunState | string, updates?: Partial<RunState>): Promise<void> {
  // Support both signatures: updateRun(run) and updateRun(runId, updates)
  if (typeof runOrId === 'string') {
    const runId = runOrId
    const existingRun = await getRun(runId)
    if (!existingRun) {
      console.error(`[storage] Run ${runId} not found for update`)
      return
    }
    const updatedRun: RunState = {
      ...existingRun,
      ...updates,
      updatedAt: new Date().toISOString()
    }
    await saveRun(updatedRun)
  } else {
    const run = runOrId
    run.updatedAt = new Date().toISOString()
    await saveRun(run)
  }
}

async function saveRun(run: RunState): Promise<void> {
  const path = getRunPath(run.id)
  writeFileSync(path, JSON.stringify(run, null, 2), 'utf-8')
}

export async function listRuns(): Promise<RunState[]> {
  const dataDir = getDataDir()
  const files = readdirSync(dataDir).filter(f => f.endsWith('.json'))
  
  const runs: RunState[] = []
  for (const file of files) {
    try {
      const data = readFileSync(join(dataDir, file), 'utf-8')
      runs.push(JSON.parse(data) as RunState)
    } catch (error) {
      console.error(`Failed to read run file ${file}:`, error)
    }
  }

  // Sort by most recent first
  return runs.sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

export async function deleteRun(runId: string): Promise<void> {
  const path = getRunPath(runId)
  if (existsSync(path)) {
    const { unlinkSync } = await import('fs')
    unlinkSync(path)
  }
}
