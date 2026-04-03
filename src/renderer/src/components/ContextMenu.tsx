import React, { useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { EventGroup } from '../../../shared/types'

const PRESET_COLORS = [
  '#f87171', '#fb923c', '#fbbf24', '#a3e635',
  '#34d399', '#22d3ee', '#60a5fa', '#a78bfa', '#f472b6',
  '#ffffff', '#9ca3af', '#374151'
]

export function ContextMenu(): JSX.Element {
  const {
    contextMenu, logs, setContextMenu,
    setGroupColor, setGroupSignificant,
    hideDate, hideAllOtherDates, hideGroup
  } = useAppStore()
  const menuRef = useRef<HTMLDivElement>(null)
  const [showColorPicker, setShowColorPicker] = useState(false)

  if (!contextMenu) return <></>

  // Clamp position to viewport
  const x = Math.min(contextMenu.x, window.innerWidth - 220)
  const y = Math.min(contextMenu.y, window.innerHeight - 320)

  // ── Date context menu ───────────────────────────────────────────────────
  if (contextMenu.type === 'date') {
    const { date, logId } = contextMenu
    const log = logs.find(l => l.id === logId)
    const bucket = log?.buckets.find(b => b.date === date)
    const label = date === 'Unknown' ? 'Unknown Date' : date

    return (
      <div
        ref={menuRef}
        className="context-menu"
        style={{ left: x, top: y }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-3 py-1 text-[10px] text-gray-500 uppercase tracking-wider border-b border-surface-600 mb-1">
          📅 {label}
          {bucket ? ` · ${bucket.groups.length} groups` : ''}
        </div>
        <button
          className="context-menu-item w-full text-left"
          onClick={() => {
            hideDate(logId, date)
            setContextMenu(null)
          }}
        >
          <span>🚫</span> Hide Date
        </button>
        {(log?.buckets.length ?? 0) > 1 && (
          <button
            className="context-menu-item w-full text-left"
            onClick={() => {
              hideAllOtherDates(logId, date)
              setContextMenu(null)
            }}
          >
            <span>🎯</span> Focus on This Day
          </button>
        )}
      </div>
    )
  }

  // ── Group context menu ──────────────────────────────────────────────────
  const log = logs.find(l => l.id === contextMenu.logId)
  const group: EventGroup | undefined = log?.buckets
    .flatMap(b => b.groups)
    .find(g => g.id === contextMenu.groupId)

  if (!group) return <></>

  const handleClearColor = () => {
    setGroupColor(contextMenu.logId, contextMenu.groupId, undefined)
    setContextMenu(null)
  }

  const handleSetColor = (color: string) => {
    setGroupColor(contextMenu.logId, contextMenu.groupId, color)
    setContextMenu(null)
  }

  const handleToggleSignificant = () => {
    setGroupSignificant(contextMenu.logId, contextMenu.groupId, !group.significant)
    setContextMenu(null)
  }

  const handleExport = async () => {
    const lines = group.entries.map(e => e.raw).join('\n')
    await window.api.exportLog(lines, `group-export.log`)
    setContextMenu(null)
  }

  const handleCopyTemplate = () => {
    navigator.clipboard.writeText(group.template)
    setContextMenu(null)
  }

  const handleHide = () => {
    hideGroup(contextMenu.logId, contextMenu.groupId)
    setContextMenu(null)
  }

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: x, top: y }}
      onClick={e => e.stopPropagation()}
    >
      <div className="px-3 py-1 text-[10px] text-gray-500 uppercase tracking-wider border-b border-surface-600 mb-1">
        {group.level ?? 'Event'} · ×{group.count}
      </div>

      <button className="context-menu-item w-full text-left" onClick={() => setShowColorPicker(s => !s)}>
        <span>🎨</span> Set Color
      </button>

      {showColorPicker && (
        <div className="px-3 pb-2">
          <div className="grid grid-cols-6 gap-1 mt-1">
            {PRESET_COLORS.map(color => (
              <button
                key={color}
                className="w-6 h-6 rounded border-2 transition-transform hover:scale-110"
                style={{
                  background: color,
                  borderColor: group.color === color ? '#fff' : 'transparent'
                }}
                onClick={() => handleSetColor(color)}
              />
            ))}
          </div>
          <input
            type="color"
            className="mt-1 w-full h-7 rounded cursor-pointer bg-transparent border-0"
            value={group.color ?? '#60a5fa'}
            onChange={e => setGroupColor(contextMenu.logId, contextMenu.groupId, e.target.value)}
          />
        </div>
      )}

      {group.color && (
        <button className="context-menu-item w-full text-left" onClick={handleClearColor}>
          <span>✕</span> Clear Color
        </button>
      )}

      <div className="border-t border-surface-600 my-1" />

      <button className="context-menu-item w-full text-left" onClick={handleToggleSignificant}>
        <span>{group.significant ? '🔇' : '🔔'}</span>
        {group.significant ? 'Mark Non-Significant' : 'Mark Significant'}
      </button>

      <button className="context-menu-item w-full text-left" onClick={handleHide}>
        <span>🚫</span> Hide Event Group
      </button>

      <div className="border-t border-surface-600 my-1" />

      <button className="context-menu-item w-full text-left" onClick={handleCopyTemplate}>
        <span>📋</span> Copy Pattern
      </button>

      <button className="context-menu-item w-full text-left" onClick={handleExport}>
        <span>💾</span> Export Group ({group.count} entries)
      </button>
    </div>
  )
}

