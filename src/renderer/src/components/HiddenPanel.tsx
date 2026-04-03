import React from 'react'
import { useAppStore } from '../store/useAppStore'

export function HiddenPanel(): JSX.Element {
  const { logs, hiddenDates, hiddenGroups, unhideDate, unhideGroup } = useAppStore()

  // Collect all hidden items across logs
  const sections: Array<{
    log: (typeof logs)[0]
    dates: string[]
    groups: Array<{ id: string; template: string; level: string | null; count: number }>
  }> = logs.map(log => {
    const dates = hiddenDates[log.id] ?? []
    const groupIds = new Set(hiddenGroups[log.id] ?? [])
    const groups = log.buckets
      .flatMap(b => b.groups)
      .filter(g => groupIds.has(g.id))
      .map(g => ({ id: g.id, template: g.template, level: g.level, count: g.count }))
    return { log, dates, groups }
  }).filter(s => s.dates.length > 0 || s.groups.length > 0)

  const totalHidden = sections.reduce((acc, s) => acc + s.dates.length + s.groups.length, 0)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-surface-800 border-b border-surface-600 shrink-0">
        <span className="text-xs text-gray-400 font-semibold">🚫 Hidden Items</span>
        <span className="badge bg-surface-600 text-gray-400">{totalHidden} hidden</span>
        <span className="text-[10px] text-gray-600">Right-click dates or events to hide them · click ✕ to restore</span>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {sections.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-600">
            <span className="text-2xl opacity-30">🚫</span>
            <span className="text-sm">No hidden items</span>
            <span className="text-xs">Right-click any date or event group to hide it</span>
          </div>
        ) : (
          sections.map(({ log, dates, groups }) => (
            <div key={log.id} className="border-b border-surface-700">
              {/* Log file header */}
              <div className="px-3 py-1.5 bg-surface-800 text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <span className="text-gray-300 font-medium">{log.fileName}</span>
                <span className="text-gray-600">{dates.length + groups.length} hidden</span>
              </div>

              {/* Hidden dates */}
              {dates.length > 0 && (
                <div className="px-3 py-1">
                  <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Dates</div>
                  <div className="flex flex-col gap-1">
                    {dates.map(date => (
                      <div key={date} className="flex items-center gap-2 py-1 px-2 bg-surface-700 rounded group">
                        <span className="text-accent-blue text-xs shrink-0">📅</span>
                        <span className="flex-1 text-xs text-gray-300 truncate">{date}</span>
                        <button
                          className="w-5 h-5 flex items-center justify-center rounded bg-red-900/50 text-red-400 hover:bg-red-700 hover:text-white transition-colors text-[10px] font-bold shrink-0 border border-red-800/50"
                          title="Remove from hidden (restore)"
                          onClick={() => unhideDate(log.id, date)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hidden groups */}
              {groups.length > 0 && (
                <div className="px-3 py-1">
                  <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Event Groups</div>
                  <div className="flex flex-col gap-1">
                    {groups.map(group => (
                      <div key={group.id} className="flex items-center gap-2 py-1 px-2 bg-surface-700 rounded group">
                        {group.level && (
                          <span className="text-[10px] text-gray-500 shrink-0 w-12 truncate">{group.level}</span>
                        )}
                        <span className="flex-1 text-xs text-gray-300 truncate min-w-0" title={group.template}>
                          {group.template || '(empty)'}
                        </span>
                        <span className="text-[10px] text-gray-500 shrink-0">×{group.count}</span>
                        <button
                          className="w-5 h-5 flex items-center justify-center rounded bg-red-900/50 text-red-400 hover:bg-red-700 hover:text-white transition-colors text-[10px] font-bold shrink-0 border border-red-800/50"
                          title="Remove from hidden (restore)"
                          onClick={() => unhideGroup(log.id, group.id)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

