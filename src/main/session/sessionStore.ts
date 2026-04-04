import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { RecentSession } from '../../shared/types'

export type { RecentSession }

interface Store {
  recentSessions: RecentSession[]
}

function getStorePath(): string {
  const userDataPath = app.getPath('userData')
  const dir = join(userDataPath, 'logpilot')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'store.json')
}

function loadStore(): Store {
  try {
    const p = getStorePath()
    if (!existsSync(p)) return { recentSessions: [] }
    return JSON.parse(readFileSync(p, 'utf-8'))
  } catch {
    return { recentSessions: [] }
  }
}

function saveStore(store: Store): void {
  writeFileSync(getStorePath(), JSON.stringify(store, null, 2), 'utf-8')
}

export function getRecentSessions(): RecentSession[] {
  return loadStore().recentSessions
}

export function addRecentSession(session: RecentSession): void {
  const store = loadStore()
  // Remove duplicate if exists
  store.recentSessions = store.recentSessions.filter(s => s.id !== session.id)
  // Prepend and cap at 20
  store.recentSessions.unshift(session)
  store.recentSessions = store.recentSessions.slice(0, 20)
  saveStore(store)
}

export function removeRecentSession(sessionId: string): void {
  const store = loadStore()
  store.recentSessions = store.recentSessions.filter(s => s.id !== sessionId)
  saveStore(store)
}

