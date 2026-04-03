import React, { useMemo, useRef, useEffect, useState } from 'react'
import { useAppStore, LoadedLog } from '../store/useAppStore'
import { LogEntry } from '../../../shared/types'
import { DaySection } from './DaySection'
import { getLevelColor, DEFAULT_LEVEL_COLORS } from '../utils/levelColors'
import { MinimapPanel, MinimapEntry } from './MinimapPanel'

const ROW_HEIGHT = 22 // px — .log-row py-0.5 at 13px font ≈ 22px
const OVERSCAN = 25  // extra rows to render above/below the visible window

// WARN and WARNING share one button; this maps a group's level to the canonical button key
function canonicalLevel(level: string | null): string {
  if (!level) return 'UNKNOWN'
  if (level === 'WARNING') return 'WARN'
  return level
}

// Ordered list of buttons to show (severity high → low)
const LEVEL_ORDER = ['FATAL', 'CRITICAL', 'ERROR', 'WARN', 'NOTICE', 'INFO', 'DEBUG', 'TRACE', 'UNKNOWN']

interface Props {
  log: LoadedLog
  /** Optional external ref for the scroll container — used by SideBySideView for synchronized wheel scroll */
  scrollContainerRef?: React.RefObject<HTMLDivElement>
}

export function LogViewer({ log, scrollContainerRef }: Props): JSX.Element {
  const { settings, searchTerms, viewModes, hiddenDates, hiddenGroups, levelFilters, toggleLevelFilter, selectedEntry } = useAppStore()
  const searchTerm = searchTerms[log.id] ?? ''
  const viewMode = viewModes[log.id] ?? 'grouped'
  const myHiddenDates = hiddenDates[log.id] ?? []
  const myHiddenGroups = hiddenGroups[log.id] ?? []
  const hiddenLevels = levelFilters[log.id] ?? []
  const internalRef = useRef<HTMLDivElement>(null)
  const containerRef = (scrollContainerRef ?? internalRef) as React.RefObject<HTMLDivElement>
  const [scrollTop, setScrollTop] = useState(0)

  // Which canonical levels are present in this log and how many groups each has
  const presentLevels = useMemo(() => {
    const counts = new Map<string, number>()
    for (const bucket of log.buckets) {
      for (const group of bucket.groups) {
        const key = canonicalLevel(group.level)
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
    }
    return LEVEL_ORDER
      .filter(l => counts.has(l))
      .map(l => ({
        level: l,
        count: counts.get(l)!,
        color: DEFAULT_LEVEL_COLORS[(l === 'WARN' ? 'WARN' : l) as keyof typeof DEFAULT_LEVEL_COLORS] ?? '#9ca3af'
      }))
  }, [log.buckets])

  const filteredBuckets = useMemo(() => {
    const term = searchTerm.toLowerCase()
    return log.buckets
      .filter(bucket => !myHiddenDates.includes(bucket.date))
      .map(bucket => {
        const groups = bucket.groups.filter(g => {
          if (myHiddenGroups.includes(g.id)) return false
          if (!settings.showNonSignificant && !g.significant) return false
          if (hiddenLevels.length > 0 && hiddenLevels.includes(canonicalLevel(g.level))) return false
          if (term) {
            const inTemplate = g.template.toLowerCase().includes(term)
            const inEntries = g.entries.some(e => e.raw.toLowerCase().includes(term))
            return inTemplate || inEntries
          }
          return true
        })
        return { ...bucket, groups }
      })
      .filter(b => b.groups.length > 0)
  }, [log.buckets, settings.showNonSignificant, searchTerm, myHiddenDates, myHiddenGroups, hiddenLevels])

  // Use groups (not individual entries) for the minimap — far fewer items, same color-density view.
  // In chronological mode, sort groups by firstSeen so the density map matches the visible order.
  const minimapEntries = useMemo((): MinimapEntry[] => {
    const groups = filteredBuckets.flatMap(b =>
      b.groups.map(g => ({ id: g.id, levelColor: g.color ?? getLevelColor(g.level), firstSeen: g.firstSeen }))
    )
    if (viewMode === 'chronological') {
      groups.sort((a, b) => {
        if (!a.firstSeen && !b.firstSeen) return 0
        if (!a.firstSeen) return 1
        if (!b.firstSeen) return -1
        return a.firstSeen.getTime() - b.firstSeen.getTime()
      })
    }
    return groups.map(({ id, levelColor }) => ({ id, levelColor }))
  }, [filteredBuckets, viewMode])

  // Find the group that contains the selected entry so the minimap can mark it
  const selectedGroupId = useMemo(() => {
    if (!selectedEntry || selectedEntry.logId !== log.id) return null
    for (const bucket of filteredBuckets) {
      for (const group of bucket.groups) {
        if (group.entries.some(e => e.id === selectedEntry.entryId)) return group.id
      }
    }
    return null
  }, [selectedEntry, filteredBuckets, log.id])

  // Flat chronological list — uses log.buckets directly to skip the showNonSignificant filter
  // Only applies the user's explicit filters: hidden dates, hidden groups, level toggles, search
  const chronologicalEntries = useMemo(() => {
    if (viewMode !== 'chronological') return []
    const term = searchTerm.toLowerCase()
    const entries: (LogEntry & { levelColor: string })[] = log.buckets
      .filter(bucket => !myHiddenDates.includes(bucket.date))
      .flatMap(b => b.groups.flatMap(g => {
        if (myHiddenGroups.includes(g.id)) return []
        if (hiddenLevels.length > 0 && hiddenLevels.includes(canonicalLevel(g.level))) return []
        return g.entries.map(e => ({
          ...e,
          levelColor: g.color ?? getLevelColor(g.level)
        }))
      }))
    // Sort chronologically by timestamp, fall back to line number
    entries.sort((a, b) => {
      if (!a.timestamp && !b.timestamp) return a.lineNumber - b.lineNumber
      if (!a.timestamp) return 1
      if (!b.timestamp) return -1
      return a.timestamp.getTime() - b.timestamp.getTime()
    })
    // Apply search filter after sorting so order is preserved
    return term ? entries.filter(e => e.raw.toLowerCase().includes(term)) : entries
  }, [viewMode, log.buckets, myHiddenDates, myHiddenGroups, hiddenLevels, searchTerm])

  // When switching to chronological: scroll to selected entry, or reset to top if none selected
  useEffect(() => {
    if (viewMode !== 'chronological') return
    const entryId = selectedEntry?.logId === log.id ? selectedEntry.entryId : null
    const el = containerRef.current
    if (!el) return
    const timer = setTimeout(() => {
      if (entryId) {
        const idx = chronologicalEntries.findIndex(e => e.id === entryId)
        if (idx >= 0) {
          const targetTop = idx * ROW_HEIGHT - el.clientHeight / 2 + ROW_HEIGHT / 2
          el.scrollTop = Math.max(0, targetTop)
          setScrollTop(Math.max(0, targetTop))
        }
      } else {
        // No selection — always reset to top so stale scroll doesn't blank the virtual list
        el.scrollTop = 0
        setScrollTop(0)
      }
    }, 50)
    return () => clearTimeout(timer)
  }, [viewMode, selectedEntry, log.id, chronologicalEntries])

  // Virtual window — only render rows near the visible viewport
  const { visibleEntries, paddingTop, paddingBottom } = useMemo(() => {
    if (viewMode !== 'chronological' || chronologicalEntries.length === 0) {
      return { visibleEntries: chronologicalEntries, paddingTop: 0, paddingBottom: 0 }
    }
    const containerH = containerRef.current?.clientHeight ?? 800
    const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
    const endIdx = Math.min(
      chronologicalEntries.length,
      Math.max(startIdx + 1, Math.ceil((scrollTop + containerH) / ROW_HEIGHT) + OVERSCAN)
    )
    return {
      visibleEntries: chronologicalEntries.slice(startIdx, endIdx),
      paddingTop: startIdx * ROW_HEIGHT,
      paddingBottom: (chronologicalEntries.length - endIdx) * ROW_HEIGHT
    }
  }, [viewMode, chronologicalEntries, scrollTop])

  if (log.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div className="text-sm text-gray-400">Parsing {log.fileName}…</div>
        <div className="w-48 h-1.5 bg-surface-700 rounded overflow-hidden">
          <div
            className="h-full bg-accent-blue transition-all duration-300 rounded"
            style={{ width: `${log.loadProgress ?? 0}%` }}
          />
        </div>
        <div className="text-xs text-gray-600">{log.loadProgress ?? 0}%</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Level filter bar */}
      {presentLevels.length > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-800 border-b border-surface-600 shrink-0 flex-wrap">
          {presentLevels.map(({ level, count, color }) => {
            const isHidden = hiddenLevels.includes(level)
            return (
              <button
                key={level}
                onClick={() => toggleLevelFilter(log.id, level)}
                title={isHidden ? `Show ${level} events` : `Hide ${level} events`}
                style={{
                  color: isHidden ? '#4b5563' : color,
                  borderColor: isHidden ? '#374151' : `${color}80`,
                  backgroundColor: isHidden ? 'transparent' : `${color}18`,
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold tracking-wide transition-all duration-150 hover:opacity-80"
              >
                {level}
                <span className="font-normal opacity-60">{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Search + stats bar */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-surface-800 border-b border-surface-600 shrink-0">
        <input
          type="text"
          placeholder="Search logs…"
          value={searchTerm}
          onChange={e => useAppStore.getState().setSearchTerm(log.id, e.target.value)}
          className="flex-1 bg-surface-700 border border-surface-500 rounded px-2 py-1 text-xs text-white placeholder-gray-600 outline-none focus:border-accent-blue transition-colors"
        />
        <span className="text-xs text-gray-500 shrink-0">
          {log.totalEntries.toLocaleString()} entries
          {viewMode === 'grouped' && (
            <>
              &nbsp;·&nbsp;
              {filteredBuckets.reduce((acc, b) => acc + b.groups.length, 0)} groups
              &nbsp;·&nbsp;
              {filteredBuckets.length} day{filteredBuckets.length !== 1 ? 's' : ''}
            </>
          )}
          {viewMode === 'chronological' && (
            <>&nbsp;·&nbsp;{chronologicalEntries.length.toLocaleString()} shown</>
          )}
        </span>
        <span className="text-xs text-gray-600 shrink-0 capitalize">{log.format}</span>
      </div>

      {/* Log content + minimap */}
      <div className="flex flex-1 overflow-hidden">
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden"
        onScroll={viewMode === 'chronological' ? e => setScrollTop((e.currentTarget as HTMLDivElement).scrollTop) : undefined}
      >
        {viewMode === 'chronological' ? (
          chronologicalEntries.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-600 text-sm">
              {searchTerm ? 'No results match your search' : 'No log entries found'}
            </div>
          ) : (
            <>
              {paddingTop > 0 && <div style={{ height: paddingTop }} />}
              {visibleEntries.map(entry => {
                const timeStr = entry.timestamp
                  ? entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : `L${entry.lineNumber}`
                const isSelected = selectedEntry?.logId === log.id && selectedEntry?.entryId === entry.id
                return (
                  <div
                    key={entry.id}
                    data-entry-id={entry.id}
                    className={`log-row ${isSelected ? 'selected' : ''}`}
                    style={isSelected ? { borderLeftColor: entry.levelColor, background: `${entry.levelColor}12` } : undefined}
                  >
                    <span className="text-gray-400 text-[11px] w-20 shrink-0 tabular-nums">{timeStr}</span>
                    <span className="text-gray-500 text-[11px] w-8 shrink-0 tabular-nums text-right">{entry.lineNumber}</span>
                    <span
                      className="flex-1 text-xs min-w-0 font-mono break-all"
                      style={{ color: entry.levelColor !== '#9ca3af' ? entry.levelColor : undefined }}
                    >
                      {entry.message}
                    </span>
                  </div>
                )
              })}
              {paddingBottom > 0 && <div style={{ height: paddingBottom }} />}
            </>
          )
        ) : (
          filteredBuckets.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-600 text-sm">
              {searchTerm ? 'No results match your search' : 'No log entries found'}
            </div>
          ) : (
            filteredBuckets.map(bucket => (
              <DaySection
                key={bucket.date}
                bucket={bucket}
                log={log}
              />
            ))
          )
        )}
      </div>
      <MinimapPanel
        entries={minimapEntries}
        selectedEntryId={selectedGroupId}
        scrollContainerRef={containerRef}
      />
      </div>
    </div>
  )
}

