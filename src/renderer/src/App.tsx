import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from './store/useAppStore'
import { TitleBar } from './components/TitleBar'
import { TabBar } from './components/TabBar'
import { LogViewer } from './components/LogViewer'
import { SideBySideView } from './components/SideBySideView'
import { CorrelationWindow } from './components/CorrelationWindow'
import { ContextMenu } from './components/ContextMenu'
import { DropZone } from './components/DropZone'
import { WelcomeScreen } from './components/WelcomeScreen'
import { HiddenPanel } from './components/HiddenPanel'
import { randomUUID } from './utils/id'
import { LogSession, ParsedLog } from '../../shared/types'

export default function App(): JSX.Element {
  const {
    logs, activeLogId, contextMenu, correlationOpen, hiddenPanelOpen,
    sideBySideMode, setSideBySideMode,
    addLog, updateLog, setContextMenu,
    clearLogs, updateSettings, setViewMode, hideDate, hideGroup, setLevelFilters
  } = useAppStore()

  const loadFiles = useCallback(async (filePaths: string[]) => {
    for (const filePath of filePaths) {
      const id = randomUUID()
      const fileName = filePath.split(/[\\/]/).pop() ?? filePath

      // Add placeholder log while loading
      addLog({
        id,
        fileName,
        filePath,
        format: 'generic',
        totalLines: 0,
        totalEntries: 0,
        buckets: [],
        colorProfile: { id: 'default', name: 'Default', rules: [], levelColors: {} },
        loadedAt: new Date(),
        isLoading: true,
        loadProgress: 0
      })

      // Subscribe to progress
      const unsub = window.api.onParseProgress((data) => {
        if (data.filePath === filePath) {
          updateLog(id, { loadProgress: data.progress })
        }
      })

      try {
        const result = await window.api.parseLog(filePath)
        if (result.success) {
          updateLog(id, { ...result.data as ParsedLog, id, isLoading: false, loadProgress: 100 })
        } else {
          updateLog(id, { isLoading: false, fileName: `${fileName} (error)` })
        }
      } finally {
        unsub()
      }
    }
  }, [addLog, updateLog])

  const loadSession = useCallback(async (session: LogSession) => {
    // Restore global settings, then replace all loaded logs
    updateSettings(session.settings)
    clearLogs()

    for (const sessionFile of session.files) {
      const id = sessionFile.id

      addLog({
        id,
        fileName: sessionFile.fileName,
        filePath: sessionFile.filePath,
        format: 'generic',
        totalLines: 0,
        totalEntries: 0,
        buckets: [],
        colorProfile: { id: 'default', name: 'Default', rules: [], levelColors: {} },
        loadedAt: new Date(),
        isLoading: true,
        loadProgress: 0
      })

      const unsub = window.api.onParseProgress((data) => {
        if (data.filePath === sessionFile.filePath) updateLog(id, { loadProgress: data.progress })
      })

      try {
        const result = await window.api.parseLog(sessionFile.filePath)
        if (result.success) {
          const parsed = result.data as ParsedLog
          // Restore collapsed state directly into the parsed buckets/groups
          const restoredBuckets = parsed.buckets.map(b => ({
            ...b,
            collapsed: sessionFile.collapsedDays.includes(b.date),
            groups: b.groups.map(g => ({
              ...g,
              collapsed: sessionFile.collapsedGroups.includes(g.id)
            }))
          }))
          updateLog(id, { ...parsed, id, buckets: restoredBuckets, isLoading: false, loadProgress: 100 })
          // Restore per-log store state
          if (sessionFile.viewMode) setViewMode(id, sessionFile.viewMode)
          for (const date of sessionFile.hiddenDates ?? []) hideDate(id, date)
          for (const gid of sessionFile.hiddenGroups ?? []) hideGroup(id, gid)
          if (sessionFile.levelFilters?.length) setLevelFilters(id, sessionFile.levelFilters)
        } else {
          updateLog(id, { isLoading: false, fileName: `${sessionFile.fileName} (error)` })
        }
      } finally {
        unsub()
      }
    }
  }, [addLog, updateLog, clearLogs, updateSettings, setViewMode, hideDate, hideGroup, setLevelFilters])

  // Keep a ref so the window-level drop handler always reads the live log count
  // without depending on a potentially-stale closure.
  const logsLengthRef = useRef(logs.length)
  useEffect(() => { logsLengthRef.current = logs.length }, [logs.length])

  // Handle drag & drop onto the whole window (only when no logs are loaded —
  // the DropZone component handles drops once a log tab is already open and
  // calls e.stopPropagation() so the event never reaches here).
  useEffect(() => {
    const handleDrop = async (e: DragEvent) => {
      e.preventDefault()
      // Guard using the ref so we always see the latest count, never a stale closure
      if (logsLengthRef.current > 0) return
      const files = Array.from(e.dataTransfer?.files ?? []).map(f => (f as File & { path: string }).path)
      if (files.length > 0) await loadFiles(files)
    }
    const handleDragOver = (e: DragEvent) => e.preventDefault()
    window.addEventListener('drop', handleDrop)
    window.addEventListener('dragover', handleDragOver)
    return () => {
      window.removeEventListener('drop', handleDrop)
      window.removeEventListener('dragover', handleDragOver)
    }
  }, [loadFiles])

  // Handle .lfo files opened via file-association (double-click or second instance)
  useEffect(() => {
    return window.api.onOpenLfoFile(async (filePath: string) => {
      const result = await window.api.loadSession(filePath)
      if (result.success && result.data) {
        await loadSession(result.data as LogSession)
      }
    })
  }, [loadSession])

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const handle = () => setContextMenu(null)
    window.addEventListener('click', handle)
    return () => window.removeEventListener('click', handle)
  }, [contextMenu, setContextMenu])

  const activeLog = logs.find(l => l.id === activeLogId)

  // Auto-exit side-by-side if fewer than 2 logs remain
  useEffect(() => {
    if (sideBySideMode && logs.length < 2) setSideBySideMode(false)
  }, [logs.length, sideBySideMode, setSideBySideMode])

  const [correlationHeight, setCorrelationHeight] = useState(220)

  const showSideBySide = sideBySideMode && logs.length >= 2
  const showCorrelation = logs.length > 1 && correlationOpen && !hiddenPanelOpen && !showSideBySide

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface-900">
      <TitleBar onOpenFiles={loadFiles} onLoadSession={loadSession} />
      {logs.length === 0 ? (
        <WelcomeScreen onLoadFiles={loadFiles} onLoadSession={loadSession} />
      ) : (
        <>
          <TabBar onLoadFiles={loadFiles} />
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Main content */}
            <div
              className="flex-1 overflow-hidden"
              style={{ height: showCorrelation ? `calc(100% - ${correlationHeight}px)` : '100%' }}
            >
              {hiddenPanelOpen ? (
                <HiddenPanel />
              ) : showSideBySide ? (
                <SideBySideView
                  leftLog={logs[0]}
                  rightLog={logs[1]}
                  onLoadFiles={loadFiles}
                />
              ) : activeLog ? (
                <DropZone onFiles={loadFiles}>
                  <LogViewer log={activeLog} />
                </DropZone>
              ) : null}
            </div>

            {/* Correlation window (hidden in split mode) */}
            {showCorrelation && (
              <CorrelationWindow
                height={correlationHeight}
                onHeightChange={setCorrelationHeight}
              />
            )}
          </div>
        </>
      )}

      {contextMenu && <ContextMenu />}
    </div>
  )
}

