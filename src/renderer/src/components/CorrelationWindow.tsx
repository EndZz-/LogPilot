import React, { useMemo, useState, useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'
import { LogEntry } from '../../../shared/types'
import { getLevelColor, DEFAULT_LEVEL_COLORS } from '../utils/levelColors'
import { formatDateTime } from '../utils/formatTime'

const LEVEL_ORDER = ['FATAL', 'CRITICAL', 'ERROR', 'WARN', 'NOTICE', 'INFO', 'DEBUG', 'TRACE', 'UNKNOWN']

const EVTX_LABEL: Record<string, string> = {
  INFO: 'Information', WARN: 'Warning', ERROR: 'Error',
  CRITICAL: 'Critical', DEBUG: 'Verbose', FATAL: 'Critical', UNKNOWN: 'Unknown'
}

function canonicalLevel(level: string | null): string {
  if (!level) return 'UNKNOWN'
  if (level === 'WARNING') return 'WARN'
  return level
}

interface Props {
  height: number
  onHeightChange: (h: number) => void
}

export function CorrelationWindow({ height, onHeightChange }: Props): JSX.Element {
  const { logs, activeLogId, selectedEntry, settings, setCorrelationOpen, setActiveLog, setSelectedEntry } = useAppStore()
  const use24Hour = settings.use24HourTime
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [hiddenLevels, setHiddenLevels] = useState<string[]>([])
  const [rowMenu, setRowMenu] = useState<{ x: number; y: number; entry: LogEntry } | null>(null)

  const toggleLevel = useCallback((level: string) => {
    setHiddenLevels(prev => prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level])
  }, [])

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startHeight = height

    const onMouseMove = (me: MouseEvent) => {
      const delta = startY - me.clientY   // drag up → increase height
      onHeightChange(Math.max(80, Math.min(600, startHeight + delta)))
    }
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [height, onHeightChange])

  // Other logs (not the current active one)
  const otherLogs = useMemo(() =>
    logs.filter(l => l.id !== activeLogId),
    [logs, activeLogId]
  )

  const displayTab = activeTab && otherLogs.find(l => l.id === activeTab)
    ? activeTab
    : otherLogs[0]?.id ?? null

  const handleGoToEntry = useCallback((entry: LogEntry) => {
    if (!displayTab) return
    setActiveLog(displayTab)
    setSelectedEntry({ logId: displayTab, entryId: entry.id, timestamp: entry.timestamp })
    setRowMenu(null)
  }, [displayTab, setActiveLog, setSelectedEntry])

  const targetLog = useMemo(() => logs.find(l => l.id === displayTab), [logs, displayTab])

  const presentLevels = useMemo(() => {
    if (!targetLog) return []
    const counts = new Map<string, number>()
    for (const bucket of targetLog.buckets) {
      for (const group of bucket.groups) {
        const key = canonicalLevel(group.level)
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
    }
    return LEVEL_ORDER
      .filter(l => counts.has(l))
      .map(l => ({
        level: l,
        color: DEFAULT_LEVEL_COLORS[(l === 'WARN' ? 'WARN' : l) as keyof typeof DEFAULT_LEVEL_COLORS] ?? '#9ca3af'
      }))
  }, [targetLog])

  // Whether the target log has ANY timestamped entries at all
  const targetHasTimestamps = useMemo(() => {
    if (!targetLog) return false
    return targetLog.buckets.some(b => b.groups.some(g => g.entries.some(e => e.timestamp)))
  }, [targetLog])

  const correlatedEntries = useMemo(() => {
    if (!selectedEntry?.timestamp || !targetLog || !targetHasTimestamps) return []

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

    return allEntries.slice(start, end + 1)
      .filter(e => hiddenLevels.length === 0 || !hiddenLevels.includes(canonicalLevel(e.level)))
      .map(e => ({
        ...e,
        isNearest: e.id === withDiff[0].entry.id
      }))
  }, [selectedEntry, targetLog, targetHasTimestamps, settings.correlationWindowSize, hiddenLevels])

  return (
    <div className="bg-surface-800 border-t border-surface-600 shrink-0 flex flex-col" style={{ height }}>
      {/* Drag handle */}
      <div
        className="h-1.5 bg-surface-700 hover:bg-accent-blue/50 cursor-ns-resize shrink-0 transition-colors"
        onMouseDown={handleDragStart}
        title="Drag to resize"
      />
      {/* Header row: tabs + close */}
      <div className="flex items-center bg-surface-700 border-b border-surface-600 shrink-0">
        <span className="text-xs text-gray-500 px-3 py-1.5 uppercase tracking-wider shrink-0">
          ⇄ Correlation
        </span>
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

      {/* Filter bar */}
      {presentLevels.length > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-surface-800 border-b border-surface-600 shrink-0 flex-wrap">
          {presentLevels.map(({ level, color }) => {
            const isHidden = hiddenLevels.includes(level)
            const label = targetLog?.format === 'evtx' ? (EVTX_LABEL[level] ?? level) : level
            return (
              <button
                key={level}
                onClick={() => toggleLevel(level)}
                title={isHidden ? `Show ${label}` : `Hide ${label}`}
                style={{
                  color: isHidden ? '#4b5563' : color,
                  borderColor: isHidden ? '#374151' : `${color}80`,
                  backgroundColor: isHidden ? 'transparent' : `${color}18`,
                }}
                className="px-2 py-0.5 rounded border text-[11px] font-bold tracking-wide transition-all duration-150"
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {!selectedEntry ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-xs">
            Select an event in a log to see correlated entries from other files
          </div>
        ) : !targetHasTimestamps ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-xs">
            No timestamps to compare — this log has no timestamped entries
          </div>
        ) : correlatedEntries.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-xs">
            No entries match the current filters
          </div>
        ) : (
          correlatedEntries.map((entry) => {
            const isNearest = (entry as LogEntry & { isNearest?: boolean }).isNearest
            const levelLabel = entry.level
              ? (targetLog?.format === 'evtx' ? (EVTX_LABEL[canonicalLevel(entry.level)] ?? entry.level) : entry.level)
              : null
            return (
              <div
                key={entry.id}
                className={`log-row ${isNearest ? 'highlighted' : ''}`}
                style={isNearest ? { background: '#f0b42910' } : undefined}
                onContextMenu={e => { e.preventDefault(); setRowMenu({ x: e.clientX, y: e.clientY, entry }) }}
              >
                <span className="text-gray-500 w-32 shrink-0 tabular-nums text-xs">
                  {entry.timestamp ? formatDateTime(entry.timestamp, use24Hour) : `L${entry.lineNumber}`}
                </span>
                {levelLabel && (
                  <span className="text-xs font-bold shrink-0 w-20" style={{ color: getLevelColor(entry.level) }}>
                    {levelLabel}
                  </span>
                )}
                <span className="flex-1 text-sm text-gray-300 min-w-0 break-all">
                  {isNearest && <span className="text-accent-yellow mr-1">►</span>}
                  {entry.message}
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* Row context menu */}
      {rowMenu && (
        <div
          className="fixed z-50 bg-surface-700 border border-surface-500 rounded shadow-lg py-1 min-w-[140px]"
          style={{ left: rowMenu.x, top: rowMenu.y }}
          onMouseLeave={() => setRowMenu(null)}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-surface-600 transition-colors"
            onClick={() => handleGoToEntry(rowMenu.entry)}
          >
            🔍 Go to Entry
          </button>
        </div>
      )}
    </div>
  )
}

