import React, { useState } from 'react'
import { useAppStore } from '../store/useAppStore'

interface Props {
  onOpenFiles: (paths: string[]) => void
}

export function TitleBar({ onOpenFiles }: Props): JSX.Element {
  const {
    logs, settings, updateSettings,
    collapseAll, collapseDates, expandAll,
    activeLogId, viewModes, setViewMode
  } = useAppStore()
  const [showSettings, setShowSettings] = useState(false)

  const viewMode = activeLogId ? (viewModes[activeLogId] ?? 'grouped') : 'grouped'

  const handleOpen = async () => {
    const paths = await window.api.openFileDialog()
    if (paths.length) onOpenFiles(paths)
  }

  const handleSaveSession = async () => {
    // Build session from current state — delegate to parent handler later
    // For now, trigger save dialog via API
  }

  return (
    <div
      className="flex items-center h-10 bg-surface-800 border-b border-surface-600 select-none shrink-0"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <span className="text-accent-blue font-bold text-sm tracking-wide">✦ LogPilot</span>
      </div>

      {/* Toolbar buttons */}
      <div
        className="flex items-center gap-1 px-2"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button className="btn-ghost" onClick={handleOpen}>
          Open
        </button>
        {activeLogId && (
          <>
            <button
              className={`btn-ghost ${viewMode === 'chronological' ? 'text-accent-blue border-accent-blue/40' : ''}`}
              onClick={() => setViewMode(activeLogId, viewMode === 'grouped' ? 'chronological' : 'grouped')}
              title="Toggle between grouped and chronological view"
            >
              {viewMode === 'grouped' ? '≡ Chronological' : '⊞ Grouped'}
            </button>
            {viewMode === 'grouped' && (
              <>
                <button className="btn-ghost" onClick={() => collapseAll(activeLogId)}>
                  Collapse Events
                </button>
                <button className="btn-ghost" onClick={() => collapseDates(activeLogId)}>
                  Collapse Dates
                </button>
                <button className="btn-ghost" onClick={() => expandAll(activeLogId)}>
                  Expand All
                </button>
              </>
            )}
          </>
        )}
        <button
          className="btn-ghost"
          onClick={() => setShowSettings(s => !s)}
        >
          ⚙ Settings
        </button>
      </div>

      {showSettings && (
        <div
          className="absolute top-10 left-0 z-50 bg-surface-700 border border-surface-500 rounded shadow-2xl p-4 w-80"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <p className="text-xs font-semibold text-gray-300 mb-3 uppercase tracking-wider">Settings</p>
          <label className="flex items-center justify-between mb-2 text-xs text-gray-400">
            Correlation window size
            <input
              type="number" min={1} max={100}
              value={settings.correlationWindowSize}
              onChange={e => updateSettings({ correlationWindowSize: Number(e.target.value) })}
              className="w-16 bg-surface-800 border border-surface-500 rounded px-2 py-1 text-xs text-white"
            />
          </label>
          <label className="flex items-center justify-between mb-2 text-xs text-gray-400">
            Fuzzy threshold (0–1)
            <input
              type="number" min={0} max={1} step={0.05}
              value={settings.fuzzyThreshold}
              onChange={e => updateSettings({ fuzzyThreshold: Number(e.target.value) })}
              className="w-16 bg-surface-800 border border-surface-500 rounded px-2 py-1 text-xs text-white"
            />
          </label>
          <label className="flex items-center justify-between mb-2 text-xs text-gray-400">
            Auto-collapse threshold
            <input
              type="number" min={1} max={1000}
              value={settings.autoCollapseThreshold}
              onChange={e => updateSettings({ autoCollapseThreshold: Number(e.target.value) })}
              className="w-16 bg-surface-800 border border-surface-500 rounded px-2 py-1 text-xs text-white"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showNonSignificant}
              onChange={e => updateSettings({ showNonSignificant: e.target.checked })}
            />
            Show non-significant events
          </label>
          <button className="btn-ghost mt-3 w-full text-center" onClick={() => setShowSettings(false)}>
            Close
          </button>
        </div>
      )}

      {/* Drag spacer */}
      <div className="flex-1" />

      {/* Window controls */}
      <div
        className="flex items-center"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          className="w-10 h-10 flex items-center justify-center text-gray-400 hover:bg-surface-700 transition-colors text-xs"
          onClick={() => window.api.windowMinimize()}
        >─</button>
        <button
          className="w-10 h-10 flex items-center justify-center text-gray-400 hover:bg-surface-700 transition-colors text-xs"
          onClick={() => window.api.windowMaximize()}
        >▭</button>
        <button
          className="w-10 h-10 flex items-center justify-center text-gray-400 hover:bg-red-800 hover:text-white transition-colors text-xs"
          onClick={() => window.api.windowClose()}
        >✕</button>
      </div>
    </div>
  )
}

