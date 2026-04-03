import React from 'react'
import { useAppStore } from '../store/useAppStore'

interface Props {
  onLoadFiles: (paths: string[]) => void
}

export function TabBar({ onLoadFiles }: Props): JSX.Element {
  const { logs, activeLogId, setActiveLog, removeLog, hiddenDates, hiddenGroups, hiddenPanelOpen, setHiddenPanelOpen } = useAppStore()

  const totalHidden = logs.reduce((acc, log) => {
    return acc + (hiddenDates[log.id]?.length ?? 0) + (hiddenGroups[log.id]?.length ?? 0)
  }, 0)

  const handleAddTab = async () => {
    const paths = await window.api.openFileDialog()
    if (paths.length) onLoadFiles(paths)
  }

  return (
    <div className="flex items-center bg-surface-800 border-b border-surface-600 overflow-x-auto shrink-0 h-9">
      {logs.map(log => (
        <div
          key={log.id}
          className={`tab ${log.id === activeLogId ? 'active' : ''}`}
          onClick={() => { setActiveLog(log.id); setHiddenPanelOpen(false) }}
          title={log.filePath}
        >
          {log.isLoading ? (
            <span className="w-2 h-2 rounded-full bg-accent-yellow animate-pulse shrink-0" />
          ) : (
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getFormatColor(log.format) }} />
          )}
          <span className="max-w-[140px] truncate">{log.fileName}</span>
          {log.isLoading && (
            <span className="text-gray-500 text-[10px] shrink-0">{log.loadProgress}%</span>
          )}
          <button
            className="ml-1 text-gray-500 hover:text-red-400 transition-colors shrink-0 leading-none"
            onClick={(e) => { e.stopPropagation(); removeLog(log.id) }}
            title="Close tab"
          >×</button>
        </div>
      ))}
      <button
        className="tab shrink-0 text-gray-500 hover:text-gray-200 px-2"
        onClick={handleAddTab}
        title="Open log file"
      >
        + Add Log
      </button>

      {/* Hidden tab — only visible when there are hidden items */}
      {totalHidden > 0 && (
        <button
          className={`tab shrink-0 ml-auto ${hiddenPanelOpen ? 'active' : 'text-gray-400 hover:text-gray-200'}`}
          onClick={() => {
            setHiddenPanelOpen(!hiddenPanelOpen)
            // Deselect any active log tab visually by keeping activeLogId as-is;
            // the App will show the hidden panel instead when hiddenPanelOpen is true
          }}
          title="View hidden dates and event groups"
        >
          <span className="text-red-400">🚫</span>
          Hidden ({totalHidden})
        </button>
      )}
    </div>
  )
}

function getFormatColor(format: string): string {
  const map: Record<string, string> = {
    json:           '#a78bfa',
    apache:         '#fb923c',
    nginx:          '#22d3ee',
    python:         '#fbbf24',
    syslog:         '#34d399',
    'windows-event':'#60a5fa',
    log4j:          '#f87171',
    generic:        '#6b7280'
  }
  return map[format] ?? '#6b7280'
}

