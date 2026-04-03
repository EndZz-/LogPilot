import React, { useRef, useEffect, useState, useCallback } from 'react'
import { LoadedLog } from '../store/useAppStore'
import { LogViewer } from './LogViewer'
import { DropZone } from './DropZone'

interface Props {
  leftLog: LoadedLog
  rightLog: LoadedLog
  onLoadFiles: (paths: string[]) => void
}

export function SideBySideView({ leftLog, rightLog, onLoadFiles }: Props): JSX.Element {
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const isSyncingRef = useRef(false)

  // Resizable split: leftWidth is a percentage (0–100)
  const [leftWidth, setLeftWidth] = useState(50)
  const isDraggingRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Synchronized mouse wheel — wheel on either panel scrolls both
  useEffect(() => {
    const handleWheel = (e: WheelEvent, source: 'left' | 'right') => {
      e.preventDefault()
      if (isSyncingRef.current) return
      isSyncingRef.current = true

      const left = leftRef.current
      const right = rightRef.current
      if (left && right) {
        left.scrollTop += e.deltaY
        right.scrollTop += e.deltaY
      }

      // Allow next frame to process before releasing the lock
      requestAnimationFrame(() => { isSyncingRef.current = false })
    }

    const leftEl = leftRef.current
    const rightEl = rightRef.current
    const onLeft = (e: WheelEvent) => handleWheel(e, 'left')
    const onRight = (e: WheelEvent) => handleWheel(e, 'right')

    leftEl?.addEventListener('wheel', onLeft, { passive: false })
    rightEl?.addEventListener('wheel', onRight, { passive: false })
    return () => {
      leftEl?.removeEventListener('wheel', onLeft)
      rightEl?.removeEventListener('wheel', onRight)
    }
  }, [])

  // Drag handle resize
  const onMouseDownDivider = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingRef.current = true

    const onMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct = ((ev.clientX - rect.left) / rect.width) * 100
      setLeftWidth(Math.min(80, Math.max(20, pct)))
    }
    const onUp = () => { isDraggingRef.current = false }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp, { once: true })
  }, [])

  return (
    <div ref={containerRef} className="flex flex-1 overflow-hidden h-full">
      {/* Left panel */}
      <div className="flex flex-col overflow-hidden" style={{ width: `${leftWidth}%` }}>
        <div className="px-2 py-0.5 bg-surface-700 border-b border-surface-600 text-[10px] text-gray-400 truncate shrink-0" title={leftLog.filePath}>
          {leftLog.fileName}
        </div>
        <div className="flex-1 overflow-hidden">
          <DropZone onFiles={onLoadFiles}>
            <LogViewer log={leftLog} scrollContainerRef={leftRef} />
          </DropZone>
        </div>
      </div>

      {/* Drag divider */}
      <div
        className="w-1 bg-surface-600 hover:bg-accent-blue cursor-col-resize shrink-0 transition-colors"
        onMouseDown={onMouseDownDivider}
        title="Drag to resize"
      />

      {/* Right panel */}
      <div className="flex flex-col overflow-hidden flex-1">
        <div className="px-2 py-0.5 bg-surface-700 border-b border-surface-600 text-[10px] text-gray-400 truncate shrink-0" title={rightLog.filePath}>
          {rightLog.fileName}
        </div>
        <div className="flex-1 overflow-hidden">
          <DropZone onFiles={onLoadFiles}>
            <LogViewer log={rightLog} scrollContainerRef={rightRef} />
          </DropZone>
        </div>
      </div>
    </div>
  )
}

