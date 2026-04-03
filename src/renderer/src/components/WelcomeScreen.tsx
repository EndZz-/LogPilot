import React from 'react'

interface Props {
  onLoadFiles: (paths: string[]) => void
}

export function WelcomeScreen({ onLoadFiles }: Props): JSX.Element {
  const handleOpen = async () => {
    const paths = await window.api.openFileDialog()
    if (paths.length) onLoadFiles(paths)
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center p-8 bg-surface-900">
      <div className="text-6xl opacity-20 select-none">✦</div>
      <div>
        <h1 className="text-2xl font-bold text-gray-200 tracking-wide">LogPilot</h1>
        <p className="text-sm text-gray-500 mt-1">Smart log organizer — drag, drop, explore</p>
      </div>
      <div
        className="border-2 border-dashed border-surface-500 hover:border-accent-blue rounded-xl p-12 cursor-pointer transition-colors group w-full max-w-md"
        onClick={handleOpen}
      >
        <p className="text-gray-500 group-hover:text-gray-300 transition-colors text-sm">
          Drop log files here or click to open
        </p>
        <p className="text-gray-600 text-xs mt-1">
          Supports .log, .txt, .json, .out and any text log format
        </p>
      </div>
      <div className="text-xs text-gray-600 space-y-1">
        <p>Multi-file tabs • Fuzzy event grouping • Correlation timeline • Color coding • Session save (.lfo)</p>
      </div>
    </div>
  )
}

