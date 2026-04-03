import React, { useMemo, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { LogEntry } from '../../../shared/types'
import { getLevelColor } from '../utils/levelColors'

export function CorrelationWindow(): JSX.Element {
  const { logs, activeLogId, selectedEntry, settings, setCorrelationOpen } = useAppStore()
  const [activeTab, setActiveTab] = useState<string | null>(null)

  // Other logs (not the current active one)
  const otherLogs = useMemo(() =>
    logs.filter(l => l.id !== activeLogId),
    [logs, activeLogId]
  )

  const displayTab = activeTab && otherLogs.find(l => l.id === activeTab)
    ? activeTab
    : otherLogs[0]?.id ?? null

  const correlatedEntries = useMemo(() => {
    if (!selectedEntry?.timestamp || !displayTab) return []
    const targetLog = logs.find(l => l.id === displayTab)
    if (!targetLog) return []

    const allEntries: LogEntry[] = targetLog.buckets.flatMap(b => b.groups.flatMap(g => g.entries))
    const target = selectedEntry.timestamp.getTime()
    const windowSize = settings.correlationWindowSize

    // Find nearest entry by timestamp
    const withDiff = allEntries
      .filter(e => e.timestamp)
      .map(e => ({ entry: e, diff: Math.abs(e.timestamp!.getTime() - target) }))
      .sort((a, b) => a.diff - b.diff)

    if (withDiff.length === 0) return []

    const nearestIdx = allEntries.indexOf(withDiff[0].entry)
    const start = Math.max(0, nearestIdx - windowSize)
    const end = Math.min(allEntries.length - 1, nearestIdx + windowSize)

    return allEntries.slice(start, end + 1).map(e => ({
      ...e,
      isNearest: e.id === withDiff[0].entry.id
    }))
  }, [selectedEntry, displayTab, logs, settings.correlationWindowSize])

  return (
    <div className="bg-surface-800 border-t border-surface-600 shrink-0 flex flex-col" style={{ height: 220 }}>
      {/* Header */}
      <div className="flex items-center bg-surface-700 border-b border-surface-600 shrink-0">
        <span className="text-xs text-gray-500 px-3 py-1.5 uppercase tracking-wider shrink-0">
          ⇄ Correlation
        </span>
        {/* Tabs for other logs */}
        {otherLogs.map(log => (
          <button
            key={log.id}
            className={`tab ${displayTab === log.id ? 'active' : ''}`}
            onClick={() => setActiveTab(log.id)}
          >
            {log.fileName}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-[10px] text-gray-600 px-2">
          ±{settings.correlationWindowSize} events
        </span>
        <button
          className="px-2 py-1.5 text-gray-500 hover:text-white text-xs transition-colors"
          onClick={() => setCorrelationOpen(false)}
        >✕</button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {!selectedEntry ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-xs">
            Select an event in a log to see correlated entries from other files
          </div>
        ) : correlatedEntries.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-xs">
            No timestamped entries found in this log
          </div>
        ) : (
          correlatedEntries.map((entry, i) => {
            const isNearest = (entry as LogEntry & { isNearest?: boolean }).isNearest
            return (
              <div
                key={entry.id}
                className={`log-row text-[11px] ${isNearest ? 'highlighted' : ''}`}
                style={isNearest ? { background: '#f0b42910' } : undefined}
              >
                <span className="text-gray-600 w-20 shrink-0 tabular-nums text-[10px]">
                  {entry.timestamp
                    ? entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : `L${entry.lineNumber}`}
                </span>
                {entry.level && (
                  <span className="text-[10px] font-bold shrink-0 w-14" style={{ color: getLevelColor(entry.level) }}>
                    {entry.level}
                  </span>
                )}
                <span className="flex-1 text-gray-300 min-w-0 break-all">
                  {isNearest && <span className="text-accent-yellow mr-1">►</span>}
                  {entry.message}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

