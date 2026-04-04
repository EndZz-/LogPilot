import React, { useCallback } from 'react'
import { useAppStore, LoadedLog } from '../store/useAppStore'
import { EventGroup, LogEntry } from '../../../shared/types'
import { formatTimeOnly } from '../utils/formatTime'

interface Props {
  entry: LogEntry
  group: EventGroup
  log: LoadedLog
  levelColor: string
}

export function LogEntryRow({ entry, group, log, levelColor }: Props): JSX.Element {
  const { selectedEntry, setSelectedEntry, searchTerms, settings } = useAppStore()
  const isSelected = selectedEntry?.entryId === entry.id && selectedEntry?.logId === log.id
  const searchTerm = searchTerms[log.id] ?? ''

  const handleClick = useCallback(() => {
    setSelectedEntry(
      isSelected ? null : { logId: log.id, entryId: entry.id, timestamp: entry.timestamp }
    )
  }, [isSelected, log.id, entry.id, entry.timestamp, setSelectedEntry])

  const timeStr = entry.timestamp
    ? formatTimeOnly(entry.timestamp, settings.use24HourTime)
    : `L${entry.lineNumber}`

  return (
    <div
      className={`log-row ${isSelected ? 'selected' : ''}`}
      onClick={handleClick}
      data-entry-id={entry.id}
      style={isSelected ? { borderLeftColor: levelColor } : undefined}
    >
      <span className="text-gray-400 text-[11px] w-20 shrink-0 tabular-nums">{timeStr}</span>
      <span className="text-gray-500 text-[11px] w-8 shrink-0 tabular-nums text-right">
        {entry.lineNumber}
      </span>
      <span
        className="flex-1 text-xs min-w-0 font-mono break-all"
        style={{ color: group.color ?? undefined }}
        title={entry.raw}
      >
        {searchTerm ? highlightText(entry.message, searchTerm) : entry.message}
      </span>
    </div>
  )
}

function highlightText(text: string, term: string): React.ReactNode {
  if (!term) return text
  const idx = text.toLowerCase().indexOf(term.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-accent-yellow/30 text-accent-yellow rounded-sm">{text.slice(idx, idx + term.length)}</mark>
      {text.slice(idx + term.length)}
    </>
  )
}

