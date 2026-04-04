import React, { useCallback } from 'react'
import { useAppStore, LoadedLog } from '../store/useAppStore'
import { EventGroup } from '../../../shared/types'
import { getLevelColor } from '../utils/levelColors'
import { LogEntryRow } from './LogEntryRow'
import { formatTimeOnly } from '../utils/formatTime'

interface Props {
  group: EventGroup
  log: LoadedLog
  bucketDate: string
}

export function EventGroupRow({ group, log, bucketDate }: Props): JSX.Element {
  const {
    toggleGroupCollapsed,
    setContextMenu,
    selectedEntry,
    settings
  } = useAppStore()

  const levelColor = group.color ?? getLevelColor(group.level, log.colorProfile.levelColors)

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ type: 'group', x: e.clientX, y: e.clientY, groupId: group.id, logId: log.id })
  }, [group.id, log.id, setContextMenu])

  const handleToggle = useCallback(() => {
    toggleGroupCollapsed(log.id, bucketDate, group.id)
  }, [log.id, bucketDate, group.id, toggleGroupCollapsed])

  const timeRange = formatTimeRange(group.firstSeen, group.lastSeen, settings.use24HourTime)

  return (
    <div
      className="border-b border-surface-700/50"
      style={{ borderLeft: `3px solid ${levelColor}` }}
      onContextMenu={handleContextMenu}
    >
      {/* Group header */}
      <div
        className="group-header"
        onClick={handleToggle}
        style={{ background: group.color ? `${group.color}18` : undefined }}
      >
        <span className="text-gray-500 text-xs w-4 shrink-0">
          {group.collapsed ? '▶' : '▼'}
        </span>

        {/* Level badge */}
        {group.level && (
          <span
            className="badge shrink-0 text-[10px] font-bold"
            style={{ color: levelColor, background: `${levelColor}22` }}
          >
            {group.level}
          </span>
        )}

        {/* Source */}
        {group.source && (
          <span className="text-gray-500 text-[10px] shrink-0 max-w-[100px] truncate">
            [{group.source}]
          </span>
        )}

        {/* Template message */}
        <span
          className="flex-1 text-xs truncate min-w-0"
          style={{ color: group.color ? group.color : undefined }}
          title={group.template}
        >
          {group.template || group.entries[0]?.message || '(empty)'}
        </span>

        {/* Time range */}
        <span className="text-gray-400 text-[11px] shrink-0 hidden lg:block tabular-nums">
          {timeRange}
        </span>

        {/* Count badge */}
        <span
          className="badge shrink-0"
          style={{
            background: group.count > 100 ? '#f87171' + '33' : '#60a5fa33',
            color: group.count > 100 ? '#f87171' : '#60a5fa'
          }}
        >
          ×{group.count.toLocaleString()}
        </span>

        {/* Non-significant indicator */}
        {!group.significant && (
          <span className="text-gray-700 text-[10px] shrink-0" title="Non-significant (high repetition)">
            ≈
          </span>
        )}
      </div>

      {/* Entries */}
      {!group.collapsed && (
        <div className="bg-surface-900/50">
          {group.entries.map(entry => (
            <LogEntryRow
              key={entry.id}
              entry={entry}
              group={group}
              log={log}
              levelColor={levelColor}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function formatTimeRange(first: Date | null, last: Date | null, use24Hour: boolean): string {
  if (!first) return ''
  const fmt = (d: Date) => formatTimeOnly(d, use24Hour)
  if (!last || first.getTime() === last.getTime()) return fmt(first)
  return `${fmt(first)} → ${fmt(last)}`
}

