import React, { useState, useRef } from 'react'

interface Props {
  onFiles: (paths: string[]) => void
  children: React.ReactNode
}

export function DropZone({ onFiles, children }: Props): JSX.Element {
  const [dragging, setDragging] = useState(false)
  const counter = useRef(0)

  return (
    <div
      className="relative h-full"
      onDragEnter={(e) => { e.preventDefault(); counter.current++; setDragging(true) }}
      onDragLeave={() => { counter.current--; if (counter.current === 0) setDragging(false) }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        counter.current = 0
        setDragging(false)
        const files = Array.from(e.dataTransfer.files).map(f => (f as File & { path: string }).path)
        if (files.length) onFiles(files)
      }}
    >
      {children}
      {dragging && (
        <div className="absolute inset-0 z-40 bg-surface-900/80 border-2 border-dashed border-accent-blue rounded flex items-center justify-center pointer-events-none">
          <p className="text-accent-blue text-lg font-semibold">Drop to open log</p>
        </div>
      )}
    </div>
  )
}

