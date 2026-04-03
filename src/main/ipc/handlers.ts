import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, basename } from 'path'
import { IPC, LogSession } from '../../shared/types'
import { parseLogFile } from '../parsers/logParser'
import { getRecentSessions, addRecentSession, removeRecentSession } from '../session/sessionStore'

export function setupIpcHandlers(): void {
  // ── File dialog ──────────────────────────────────────────────────────────
  ipcMain.handle(IPC.OPEN_FILE_DIALOG, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Log Files', extensions: ['log', 'txt', 'out', 'err', 'json', 'ndjson'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    return result.canceled ? [] : result.filePaths
  })

  // ── Parse log file ────────────────────────────────────────────────────────
  ipcMain.handle(IPC.PARSE_LOG, async (event, filePath: string) => {
    try {
      const parsed = await parseLogFile(filePath, (progress) => {
        event.sender.send(IPC.PARSE_LOG_PROGRESS, { filePath, progress })
      })
      return { success: true, data: parsed }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  })

  // ── Save session ──────────────────────────────────────────────────────────
  ipcMain.handle(IPC.SAVE_SESSION, async (_event, session: LogSession, savePath?: string) => {
    try {
      let targetPath = savePath
      if (!targetPath) {
        const result = await dialog.showSaveDialog({
          defaultPath: `${session.name}.lfo`,
          filters: [{ name: 'LogPilot Session', extensions: ['lfo'] }]
        })
        if (result.canceled) return { success: false, error: 'Cancelled' }
        targetPath = result.filePath
      }
      writeFileSync(targetPath!, JSON.stringify(session, null, 2), 'utf-8')
      addRecentSession({ id: session.id, name: session.name, path: targetPath!, updatedAt: new Date().toISOString() })
      return { success: true, path: targetPath }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // ── Load session ──────────────────────────────────────────────────────────
  ipcMain.handle(IPC.LOAD_SESSION, async (_event, filePath?: string) => {
    try {
      let targetPath = filePath
      if (!targetPath) {
        const result = await dialog.showOpenDialog({
          filters: [{ name: 'LogPilot Session', extensions: ['lfo'] }],
          properties: ['openFile']
        })
        if (result.canceled) return { success: false, error: 'Cancelled' }
        targetPath = result.filePaths[0]
      }
      if (!existsSync(targetPath!)) return { success: false, error: 'File not found' }
      const raw = readFileSync(targetPath!, 'utf-8')
      const session: LogSession = JSON.parse(raw)
      addRecentSession({ id: session.id, name: session.name, path: targetPath!, updatedAt: session.updatedAt })
      return { success: true, data: session, path: targetPath }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // ── Recent sessions ───────────────────────────────────────────────────────
  ipcMain.handle(IPC.GET_RECENT_SESSIONS, () => {
    return getRecentSessions()
  })

  ipcMain.handle(IPC.DELETE_SESSION, (_event, sessionId: string) => {
    removeRecentSession(sessionId)
    return { success: true }
  })

  // ── Export log ────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.EXPORT_LOG, async (_event, content: string, defaultName: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [
        { name: 'Text Files', extensions: ['txt', 'log'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (result.canceled) return { success: false }
    writeFileSync(result.filePath!, content, 'utf-8')
    return { success: true, path: result.filePath }
  })

  // ── App version ───────────────────────────────────────────────────────────
  ipcMain.handle(IPC.GET_APP_VERSION, () => app.getVersion())
}

