import { contextBridge, ipcRenderer } from 'electron'
import { IPC, LogSession } from '../shared/types'

const api = {
  // File operations
  openFileDialog: () => ipcRenderer.invoke(IPC.OPEN_FILE_DIALOG),
  parseLog: (filePath: string) => ipcRenderer.invoke(IPC.PARSE_LOG, filePath),
  onParseProgress: (cb: (data: { filePath: string; progress: number }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: { filePath: string; progress: number }) => cb(data)
    ipcRenderer.on(IPC.PARSE_LOG_PROGRESS, handler)
    return () => ipcRenderer.removeListener(IPC.PARSE_LOG_PROGRESS, handler)
  },

  // Session
  saveSession: (session: LogSession, savePath?: string) =>
    ipcRenderer.invoke(IPC.SAVE_SESSION, session, savePath),
  loadSession: (filePath?: string) => ipcRenderer.invoke(IPC.LOAD_SESSION, filePath),
  getRecentSessions: () => ipcRenderer.invoke(IPC.GET_RECENT_SESSIONS),
  deleteSession: (sessionId: string) => ipcRenderer.invoke(IPC.DELETE_SESSION, sessionId),

  // Export
  exportLog: (content: string, defaultName: string) =>
    ipcRenderer.invoke(IPC.EXPORT_LOG, content, defaultName),

  // App
  getAppVersion: () => ipcRenderer.invoke(IPC.GET_APP_VERSION),

  // Window controls
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close')
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api

