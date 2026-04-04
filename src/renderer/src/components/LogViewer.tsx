import React, { useMemo, useRef, useEffect, useState } from 'react'
import { useAppStore, LoadedLog } from '../store/useAppStore'
import { LogEntry } from '../../../shared/types'
import { DaySection } from './DaySection'
import { getLevelColor, DEFAULT_LEVEL_COLORS } from '../utils/levelColors'
import { MinimapPanel, MinimapEntry } from './MinimapPanel'
import { formatDateTime } from '../utils/formatTime'

const ROW_HEIGHT = 22 // px — .log-row py-0.5 at 13px font ≈ 22px
const OVERSCAN = 25  // extra rows to render above/below the visible window

// Stable empty array — used as ?? fallback so useMemo deps don't get a new
// reference on every render when no dates/groups/levels are filtered.
const EMPTY_ARRAY: string[] = []

// WARN and WARNING share one button; this maps a group's level to the canonical button key
function canonicalLevel(level: string | null): string {
  if (!level) return 'UNKNOWN'
  if (level === 'WARNING') return 'WARN'
  return level
}

// Ordered list of buttons to show (severity high → low)
const LEVEL_ORDER = ['FATAL', 'CRITICAL', 'ERROR', 'WARN', 'NOTICE', 'INFO', 'DEBUG', 'TRACE', 'UNKNOWN']

// Windows Event Viewer uses different display names for the same levels
const EVTX_LABEL: Record<string, string> = {
  INFO: 'Information', WARN: 'Warning', ERROR: 'Error',
  CRITICAL: 'Critical', DEBUG: 'Verbose', FATAL: 'Critical', UNKNOWN: 'Unknown'
}

interface Props {
  log: LoadedLog
  /** Optional external ref for the scroll container — used by SideBySideView for synchronized wheel scroll */
  scrollContainerRef?: React.RefObject<HTMLDivElement>
}

export function LogViewer({ log, scrollContainerRef }: Props): JSX.Element {
  const { settings, searchTerms, viewModes, hiddenDates, hiddenGroups, levelFilters, toggleLevelFilter, selectedEntry, setSelectedEntry, toggleDayCollapsed, toggleGroupCollapsed } = useAppStore()
  const searchTerm = searchTerms[log.id] ?? ''
  const viewMode = viewModes[log.id] ?? 'grouped'
  // Use EMPTY_ARRAY as fallback so useMemo deps get a stable reference when
  // nothing is filtered — prevents spurious recomputes on every scroll event.
  const myHiddenDates = hiddenDates[log.id] ?? EMPTY_ARRAY
  const myHiddenGroups = hiddenGroups[log.id] ?? EMPTY_ARRAY
  const hiddenLevels = levelFilters[log.id] ?? EMPTY_ARRAY
  const internalRef = useRef<HTMLDivElement>(null)
  const containerRef = (scrollContainerRef ?? internalRef) as React.RefObject<HTMLDivElement>
  const [scrollTop, setScrollTop] = useState(0)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [rowMenu, setRowMenu] = useState<{ x: number; y: number; line: string } | null>(null)

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
    const buckets = log.buckets
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
    // Apply sort order: desc reverses the bucket (day) order
    return sortOrder === 'desc' ? [...buckets].reverse() : buckets
  }, [log.buckets, settings.showNonSignificant, searchTerm, myHiddenDates, myHiddenGroups, hiddenLevels, sortOrder])

  // Use groups (not individual entries) for the minimap — far fewer items, same color-density view.
  // In chronological mode, sort groups by firstSeen so the density map matches the visible order.
  const minimapEntries = useMemo((): MinimapEntry[] => {
    const groups = filteredBuckets.flatMap(b =>
      b.groups.map(g => ({
        id: g.id,
        levelColor: g.color ?? getLevelColor(g.level),
        firstLine: g.entries[0]?.lineNumber ?? 0
      }))
    )
    if (viewMode === 'chronological') {
      // Minimap density matches chronological view: sort by first line number of each group
      groups.sort((a, b) => a.firstLine - b.firstLine)
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

  // Chronological view: mixed array of date-header items and entry items.
  type ChronoItem =
    | { kind: 'header'; date: string; count: number; collapsed: boolean }
    | { kind: 'entry'; entry: LogEntry & { levelColor: string } }

  const chronoItems = useMemo((): ChronoItem[] => {
    if (viewMode !== 'chronological') return []

    // 1. Collect all visible entries (filteredBuckets respects hidden dates/groups/levels)
    const allEntries = filteredBuckets.flatMap(b =>
      b.groups.flatMap(g => g.entries.map(e => ({ ...e, levelColor: g.color ?? getLevelColor(g.level) })))
    )

    // 2. Search filter at entry level
    const term = searchTerm.toLowerCase()
    const searched = term ? allEntries.filter(e => e.raw.toLowerCase().includes(term)) : allEntries

    // 3. Sort ascending by line number — this is always the base order so date
    //    assignment matches the physical order of lines in the file.
    searched.sort((a, b) => a.lineNumber - b.lineNumber)

    // 4. Walk in line order, carrying the last known date forward so that entries
    //    without timestamps inherit the date of the nearest preceding timestamped line.
    let currentDate = 'Unknown'
    const dated = searched.map(entry => {
      if (entry.timestamp) currentDate = entry.timestamp.toISOString().slice(0, 10)
      return { entry, date: currentDate }
    })

    // 5. Group by date in the order they first appear in the file (Map preserves insertion order)
    const groups = new Map<string, Array<typeof allEntries[0]>>()
    for (const { entry, date } of dated) {
      if (!groups.has(date)) groups.set(date, [])
      groups.get(date)!.push(entry)
    }

    // 6. Apply sort direction: desc reverses both the group order and entries within each group
    const orderedGroups = [...groups.entries()]
    if (sortOrder === 'desc') {
      orderedGroups.reverse()
      for (const [, entries] of orderedGroups) entries.reverse()
    }

    // 7. Look up collapse state from the original buckets
    const collapsedByDate = new Map(log.buckets.map(b => [b.date, b.collapsed]))

    // 8. Build final flat items array for the virtual list
    const items: ChronoItem[] = []
    for (const [date, entries] of orderedGroups) {
      const collapsed = collapsedByDate.get(date) ?? false
      items.push({ kind: 'header', date, count: entries.length, collapsed })
      if (!collapsed) {
        for (const entry of entries) items.push({ kind: 'entry', entry })
      }
    }
    return items
  }, [viewMode, filteredBuckets, searchTerm, sortOrder, log.buckets])

  // When switching to chronological: scroll to selected entry, or reset to top if none selected
  useEffect(() => {
    if (viewMode !== 'chronological') return
    const entryId = selectedEntry?.logId === log.id ? selectedEntry.entryId : null
    const el = containerRef.current
    if (!el) return
    const timer = setTimeout(() => {
      if (entryId) {
        const idx = chronoItems.findIndex(item => item.kind === 'entry' && item.entry.id === entryId)
        if (idx >= 0) {
          const targetTop = idx * ROW_HEIGHT - el.clientHeight / 2 + ROW_HEIGHT / 2
          el.scrollTop = Math.max(0, targetTop)
          setScrollTop(Math.max(0, targetTop))
        }
      } else {
        el.scrollTop = 0
        setScrollTop(0)
      }
    }, 50)
    return () => clearTimeout(timer)
  }, [viewMode, selectedEntry, log.id, chronoItems])

  // When an entry is selected in grouped mode (e.g. navigated from correlation window):
  // expand the containing group if collapsed, then scroll to the entry element.
  useEffect(() => {
    if (viewMode !== 'grouped') return
    if (!selectedEntry || selectedEntry.logId !== log.id) return
    const el = containerRef.current
    if (!el) return

    // Find which bucket + group holds this entry
    let bucketDate: string | null = null
    let groupId: string | null = null
    let collapsed = false
    outer: for (const bucket of log.buckets) {
      for (const group of bucket.groups) {
        if (group.entries.some(e => e.id === selectedEntry.entryId)) {
          bucketDate = bucket.date
          groupId = group.id
          collapsed = group.collapsed
          break outer
        }
      }
    }
    if (!bucketDate || !groupId) return

    const doScroll = () => {
      const target = el.querySelector(`[data-entry-id="${selectedEntry.entryId}"]`)
      if (target) target.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }

    if (collapsed) {
      toggleGroupCollapsed(log.id, bucketDate, groupId)
      setTimeout(doScroll, 80)
    } else {
      setTimeout(doScroll, 50)
    }
  }, [selectedEntry, log.id, viewMode]) // intentionally omit log.buckets to avoid re-firing on every bucket update

  // Virtual window — only render items near the visible viewport
  const { visibleItems, paddingTop, paddingBottom } = useMemo(() => {
    if (viewMode !== 'chronological' || chronoItems.length === 0) {
      return { visibleItems: chronoItems, paddingTop: 0, paddingBottom: 0 }
    }
    const containerH = containerRef.current?.clientHeight ?? 800
    const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
    const endIdx = Math.min(
      chronoItems.length,
      Math.max(startIdx + 1, Math.ceil((scrollTop + containerH) / ROW_HEIGHT) + OVERSCAN)
    )
    return {
      visibleItems: chronoItems.slice(startIdx, endIdx),
      paddingTop: startIdx * ROW_HEIGHT,
      paddingBottom: (chronoItems.length - endIdx) * ROW_HEIGHT
    }
  }, [viewMode, chronoItems, scrollTop])

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
      {/* Level filter bar + sort button */}
      {(presentLevels.length > 0 || viewMode === 'chronological') && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-800 border-b border-surface-600 shrink-0 flex-wrap">
          {presentLevels.map(({ level, count, color }) => {
            const isHidden = hiddenLevels.includes(level)
            const label = log.format === 'evtx' ? (EVTX_LABEL[level] ?? level) : level
            return (
              <button
                key={level}
                onClick={() => toggleLevelFilter(log.id, level)}
                title={isHidden ? `Show ${label} events` : `Hide ${label} events`}
                style={{
                  color: isHidden ? '#4b5563' : color,
                  borderColor: isHidden ? '#374151' : `${color}80`,
                  backgroundColor: isHidden ? 'transparent' : `${color}18`,
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold tracking-wide transition-all duration-150 hover:opacity-80"
              >
                {label}
                <span className="font-normal opacity-60">{count}</span>
              </button>
            )
          })}
          {/* Sort button — far right, works in both grouped and chronological modes */}
          <button
            onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
            title={sortOrder === 'asc' ? 'Oldest first — click to show newest first' : 'Newest first — click to show oldest first'}
            className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold tracking-wide transition-all duration-150 hover:opacity-80 text-gray-400 border-surface-600 hover:border-accent-blue hover:text-accent-blue"
          >
            {sortOrder === 'asc' ? '↑ Oldest First' : '↓ Newest First'}
          </button>
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
            <>&nbsp;·&nbsp;{chronoItems.filter(i => i.kind === 'entry').length.toLocaleString()} shown</>
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
          chronoItems.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-600 text-sm">
              {searchTerm ? 'No results match your search' : 'No log entries found'}
            </div>
          ) : (
            <>
              {paddingTop > 0 && <div style={{ height: paddingTop }} />}
              {visibleItems.map((item, relIdx) => {
                if (item.kind === 'header') {
                  return (
                    <div
                      key={`hdr-${item.date}`}
                      className="flex items-center gap-2 px-3 bg-surface-750 border-y border-surface-600 cursor-pointer select-none hover:bg-surface-700 transition-colors"
                      style={{ height: ROW_HEIGHT, minHeight: ROW_HEIGHT }}
                      onClick={() => toggleDayCollapsed(log.id, item.date)}
                    >
                      <span className="text-gray-500 text-[11px]">{item.collapsed ? '▶' : '▼'}</span>
                      <span className="text-xs font-semibold text-gray-300">{item.date}</span>
                      <span className="text-[10px] text-gray-500">{item.count.toLocaleString()} events</span>
                    </div>
                  )
                }
                const { entry } = item
                const timeStr = entry.timestamp
                  ? formatDateTime(entry.timestamp, settings.use24HourTime)
                  : `L${entry.lineNumber}`
                const levelLabel = entry.level
                  ? (log.format === 'evtx' ? (EVTX_LABEL[canonicalLevel(entry.level)] ?? entry.level) : entry.level)
                  : ''
                const copyLine = [timeStr, entry.lineNumber, levelLabel, entry.message].filter(Boolean).join('\t')
                const isSelected = selectedEntry?.logId === log.id && selectedEntry?.entryId === entry.id
                return (
                  <div
                    key={entry.id}
                    data-entry-id={entry.id}
                    className={`log-row ${isSelected ? 'selected' : ''}`}
                    style={isSelected ? { borderLeftColor: entry.levelColor, background: `${entry.levelColor}12` } : undefined}
                    onClick={() => setSelectedEntry(isSelected ? null : { logId: log.id, entryId: entry.id, timestamp: entry.timestamp })}
                    onContextMenu={e => { e.preventDefault(); setRowMenu({ x: e.clientX, y: e.clientY, line: copyLine }) }}
                  >
                    <span className="text-gray-400 text-[11px] w-32 shrink-0 tabular-nums">{timeStr}</span>
                    <span className="text-gray-500 text-[11px] w-8 shrink-0 tabular-nums text-right">{entry.lineNumber}</span>
                    {levelLabel && (
                      <span className="text-[10px] font-bold w-20 shrink-0 text-center px-1" style={{ color: entry.levelColor }}>
                        {levelLabel}
                      </span>
                    )}
                    <span className="flex-1 text-xs min-w-0 font-mono break-all" style={{ color: entry.levelColor !== '#9ca3af' ? entry.levelColor : undefined }}>
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

      {/* Row right-click context menu */}
      {rowMenu && (
        <div
          className="fixed z-50 bg-surface-700 border border-surface-500 rounded shadow-xl py-1 min-w-[160px]"
          style={{ left: rowMenu.x, top: rowMenu.y }}
          onMouseLeave={() => setRowMenu(null)}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-surface-600 transition-colors"
            onClick={() => { navigator.clipboard.writeText(rowMenu.line); setRowMenu(null) }}
          >
            📋 Copy Line
          </button>
        </div>
      )}
    </div>
  )
}

