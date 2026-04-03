import React, { useRef, useEffect, useState, useCallback } from 'react'

export interface MinimapEntry {
  id: string
  levelColor: string
}

interface Props {
  entries: MinimapEntry[]
  selectedEntryId: string | null
  scrollContainerRef: React.RefObject<HTMLDivElement>
}

export function MinimapPanel({ entries, selectedEntryId, scrollContainerRef }: Props): JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDragging = useRef(false)
  const [dims, setDims] = useState({ w: 56, h: 400 })
  const [scrollState, setScrollState] = useState({ top: 0, scrollH: 1, clientH: 1 })

  // Keep canvas pixel dimensions in sync with panel size
  useEffect(() => {
    const el = panelRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setDims({ w: el.clientWidth, h: el.clientHeight })
    })
    ro.observe(el)
    setDims({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  // Track scroll position on the log content container
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const onScroll = () =>
      setScrollState({ top: el.scrollTop, scrollH: el.scrollHeight, clientH: el.clientHeight })
    el.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => el.removeEventListener('scroll', onScroll)
  }, [scrollContainerRef])

  // Draw the minimap whenever entries, selection, scroll, or size changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = dims.w
    const H = dims.h
    canvas.width = W
    canvas.height = H

    // Background
    ctx.fillStyle = '#0f1117'
    ctx.fillRect(0, 0, W, H)

    if (entries.length === 0) return

    // Draw one pixel row per canvas row — map back to the entry at that fraction
    const barX = 8
    const barW = W - 16
    for (let y = 0; y < H; y++) {
      const idx = Math.min(Math.floor((y / H) * entries.length), entries.length - 1)
      ctx.fillStyle = entries[idx].levelColor + 'bb'
      ctx.fillRect(barX, y, barW, 1)
    }

    // Selected entry — bright white line + colored dot
    if (selectedEntryId) {
      const idx = entries.findIndex(e => e.id === selectedEntryId)
      if (idx >= 0) {
        const y = Math.round((idx / entries.length) * H)
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.fillRect(0, Math.max(0, y - 1), W, 3)
        const dotColor = entries[idx].levelColor
        ctx.fillStyle = dotColor
        ctx.beginPath()
        ctx.arc(W / 2, Math.max(3, Math.min(H - 3, y)), 3, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Viewport overlay
    const { top, scrollH, clientH } = scrollState
    if (scrollH > clientH) {
      const vpTop = Math.floor((top / scrollH) * H)
      const vpH = Math.max(12, Math.floor((clientH / scrollH) * H))
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      ctx.fillRect(0, vpTop, W, vpH)
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'
      ctx.lineWidth = 1
      ctx.strokeRect(0.5, vpTop + 0.5, W - 1, vpH - 1)
    }
  }, [entries, selectedEntryId, scrollState, dims])

  const scrollToFraction = useCallback((clientY: number) => {
    const canvas = canvasRef.current
    const el = scrollContainerRef.current
    if (!canvas || !el) return
    const rect = canvas.getBoundingClientRect()
    const fraction = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    el.scrollTop = fraction * el.scrollHeight - el.clientHeight / 2
  }, [scrollContainerRef])

  return (
    <div
      ref={panelRef}
      className="relative shrink-0 border-l border-surface-600 select-none"
      style={{ width: 56 }}
      onMouseDown={(e) => { isDragging.current = true; scrollToFraction(e.clientY) }}
      onMouseMove={(e) => { if (isDragging.current) scrollToFraction(e.clientY) }}
      onMouseUp={() => { isDragging.current = false }}
      onMouseLeave={() => { isDragging.current = false }}
    >
      <canvas
        ref={canvasRef}
        title="Minimap — click or drag to navigate"
        style={{ display: 'block', width: '100%', height: '100%', cursor: 'crosshair' }}
      />
    </div>
  )
}

