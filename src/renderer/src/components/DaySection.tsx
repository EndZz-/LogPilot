import React, { memo, useCallback } from 'react'
import { useAppStore, LoadedLog } from '../store/useAppStore'
import { DayBucket } from '../../../shared/types'
import { EventGroupRow } from './EventGroupRow'

interface Props {
  bucket: DayBucket
  log: LoadedLog
}

export const DaySection = memo(function DaySection({ bucket, log }: Props): JSX.Element {
  const { toggleDayCollapsed, setContextMenu } = useAppStore()

  const totalCount = bucket.groups.reduce((acc, g) => acc + g.count, 0)

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ type: 'date', x: e.clientX, y: e.clientY, date: bucket.date, logId: log.id })
  }, [bucket.date, log.id, setContextMenu])

  return (
    <div>
      {/* Day header */}
      <div
        className="day-header"
        onClick={() => toggleDayCollapsed(log.id, bucket.date)}
        onContextMenu={handleContextMenu}
      >
        <span className="text-accent-blue">{bucket.collapsed ? '▶' : '▼'}</span>
        <span>{bucket.date === 'Unknown' ? '⚠ Unknown Date' : formatDate(bucket.date)}</span>
        <span className="badge bg-surface-600 text-gray-400 ml-1">
          {bucket.groups.length} groups
        </span>
        <span className="badge bg-surface-700 text-gray-500">
          {totalCount.toLocaleString()} entries
        </span>
      </div>

      {/* Event groups */}
      {!bucket.collapsed && (
        <div>
          {bucket.groups.map(group => (
            <EventGroupRow
              key={group.id}
              group={group}
              log={log}
              bucketDate={bucket.date}
            />
          ))}
        </div>
      )}
    </div>
  )
})

function formatDate(iso: string): string {
  try {
    const d = new Date(iso + 'T00:00:00')
    return d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

