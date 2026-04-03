import React, { useCallback, useEffect } from 'react'
import { useAppStore } from './store/useAppStore'
import { TitleBar } from './components/TitleBar'
import { TabBar } from './components/TabBar'
import { LogViewer } from './components/LogViewer'
import { CorrelationWindow } from './components/CorrelationWindow'
import { ContextMenu } from './components/ContextMenu'
import { DropZone } from './components/DropZone'
import { WelcomeScreen } from './components/WelcomeScreen'
import { HiddenPanel } from './components/HiddenPanel'
import { randomUUID } from './utils/id'
import { ParsedLog } from '../../shared/types'

export default function App(): JSX.Element {
  const { logs, activeLogId, contextMenu, correlationOpen, hiddenPanelOpen, addLog, updateLog, setContextMenu } = useAppStore()

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

  // Handle drag & drop onto the whole window
  useEffect(() => {
    const handleDrop = async (e: DragEvent) => {
      e.preventDefault()
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

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const handle = () => setContextMenu(null)
    window.addEventListener('click', handle)
    return () => window.removeEventListener('click', handle)
  }, [contextMenu, setContextMenu])

  const activeLog = logs.find(l => l.id === activeLogId)

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface-900">
      <TitleBar onOpenFiles={loadFiles} />
      {logs.length === 0 ? (
        <WelcomeScreen onLoadFiles={loadFiles} />
      ) : (
        <>
          <TabBar onLoadFiles={loadFiles} />
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Main content: hidden panel OR log viewer */}
            <div
              className="flex-1 overflow-hidden"
              style={{ height: correlationOpen && logs.length > 1 && !hiddenPanelOpen ? 'calc(100% - 220px)' : '100%' }}
            >
              {hiddenPanelOpen ? (
                <HiddenPanel />
              ) : activeLog ? (
                <DropZone onFiles={loadFiles}>
                  <LogViewer log={activeLog} />
                </DropZone>
              ) : null}
            </div>

            {/* Correlation window (only when 2+ logs loaded and not in hidden panel) */}
            {logs.length > 1 && correlationOpen && !hiddenPanelOpen && (
              <CorrelationWindow />
            )}
          </div>
        </>
      )}

      {contextMenu && <ContextMenu />}
    </div>
  )
}

