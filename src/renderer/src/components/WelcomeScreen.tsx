import React, { useState, useEffect } from 'react'
import { LogSession, RecentSession } from '../../../shared/types'

interface Props {
  onLoadFiles: (paths: string[]) => void
  onLoadSession: (session: LogSession) => Promise<void>
}

export function WelcomeScreen({ onLoadFiles, onLoadSession }: Props): JSX.Element {
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([])

  useEffect(() => {
    window.api.getRecentSessions().then(setRecentSessions).catch(() => {})
  }, [])

  const handleOpen = async () => {
    const paths = await window.api.openFileDialog()
    if (paths.length) onLoadFiles(paths)
  }

  const handleOpenSession = async () => {
    const result = await window.api.loadSession()
    if (result.success && result.data) {
      await onLoadSession(result.data as LogSession)
    }
  }

  const handleOpenRecent = async (session: RecentSession) => {
    const result = await window.api.loadSession(session.path)
    if (result.success && result.data) {
      await onLoadSession(result.data as LogSession)
    }
  }

  const handleDeleteRecent = async (session: RecentSession, e: React.MouseEvent) => {
    e.stopPropagation()
    await window.api.deleteSession(session.id)
    setRecentSessions(prev => prev.filter(s => s.id !== session.id))
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center p-8 bg-surface-900">
      <div className="text-6xl opacity-20 select-none">✦</div>
      <div>
        <h1 className="text-2xl font-bold text-gray-200 tracking-wide">LogPilot</h1>
        <p className="text-sm text-gray-500 mt-1">Smart log organizer — drag, drop, explore</p>
      </div>

      {/* Open actions */}
      <div className="flex gap-3">
        <div
          className="border-2 border-dashed border-surface-500 hover:border-accent-blue rounded-xl px-10 py-8 cursor-pointer transition-colors group"
          onClick={handleOpen}
        >
          <p className="text-gray-400 group-hover:text-gray-200 transition-colors text-sm font-medium">📂 Open Log Files</p>
          <p className="text-gray-600 text-xs mt-1">.log .txt .json .evtx and more</p>
        </div>
        <div
          className="border-2 border-dashed border-surface-500 hover:border-accent-blue rounded-xl px-10 py-8 cursor-pointer transition-colors group"
          onClick={handleOpenSession}
        >
          <p className="text-gray-400 group-hover:text-gray-200 transition-colors text-sm font-medium">💾 Load Session</p>
          <p className="text-gray-600 text-xs mt-1">Open a saved .lfo workspace</p>
        </div>
      </div>

      {/* Recent sessions */}
      {recentSessions.length > 0 && (
        <div className="w-full max-w-lg">
          <p className="text-xs text-gray-600 uppercase tracking-wider mb-2 text-left">Recent Sessions</p>
          <div className="space-y-1">
            {recentSessions.map(session => (
              <div
                key={session.id}
                className="flex items-center gap-3 px-3 py-2 rounded bg-surface-800 hover:bg-surface-700 cursor-pointer transition-colors group"
                onClick={() => handleOpenRecent(session)}
              >
                <span className="text-sm text-gray-400 group-hover:text-gray-200 flex-1 text-left truncate">
                  {session.name}
                </span>
                <span className="text-xs text-gray-600 shrink-0">
                  {new Date(session.updatedAt).toLocaleDateString('en-US')}
                </span>
                <button
                  className="text-gray-700 hover:text-red-400 text-xs shrink-0 transition-colors"
                  onClick={(e) => handleDeleteRecent(session, e)}
                  title="Remove from recent"
                >✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-gray-600">
        <p>Multi-file tabs • Fuzzy event grouping • Correlation timeline • Color coding • Session save (.lfo)</p>
      </div>
    </div>
  )
}

