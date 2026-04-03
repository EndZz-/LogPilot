// ── Log entry as parsed from file ──────────────────────────────────────────
export interface LogEntry {
  id: string
  raw: string
  timestamp: Date | null
  level: LogLevel | null
  source: string | null   // e.g. module/logger name
  message: string
  lineNumber: number
}

// ── Grouped event cluster (fuzzy-matched similar entries) ──────────────────
export interface EventGroup {
  id: string
  template: string        // canonical message template (vars stripped)
  level: LogLevel | null
  source: string | null
  entries: LogEntry[]
  count: number
  firstSeen: Date | null
  lastSeen: Date | null
  color?: string          // user-assigned color (hex)
  collapsed: boolean
  significant: boolean    // user can mark non-significant to auto-collapse
}

// ── Day bucket containing groups ──────────────────────────────────────────
export interface DayBucket {
  date: string            // 'YYYY-MM-DD' or 'Unknown'
  groups: EventGroup[]
  collapsed: boolean
}

// ── Parsed log file ────────────────────────────────────────────────────────
export interface ParsedLog {
  id: string
  fileName: string
  filePath: string
  format: LogFormat
  totalLines: number
  totalEntries: number
  buckets: DayBucket[]
  colorProfile: ColorProfile
  loadedAt: Date
}

// ── Log levels ─────────────────────────────────────────────────────────────
export type LogLevel =
  | 'TRACE'
  | 'DEBUG'
  | 'INFO'
  | 'NOTICE'
  | 'WARN'
  | 'WARNING'
  | 'ERROR'
  | 'CRITICAL'
  | 'FATAL'
  | 'UNKNOWN'

// ── Supported log formats ──────────────────────────────────────────────────
export type LogFormat =
  | 'generic'
  | 'json'
  | 'apache'
  | 'nginx'
  | 'python'
  | 'windows-event'
  | 'syslog'
  | 'log4j'

// ── Color profile ─────────────────────────────────────────────────────────
export interface ColorRule {
  id: string
  pattern: string           // text pattern / regex string
  isRegex: boolean
  color: string             // hex
  label?: string
  applyToLevel?: LogLevel
}

export interface ColorProfile {
  id: string
  name: string
  rules: ColorRule[]
  levelColors: Partial<Record<LogLevel, string>>
}

// ── Session (.lfo) ────────────────────────────────────────────────────────
export interface LogSession {
  version: string
  id: string
  name: string
  createdAt: string
  updatedAt: string
  files: SessionFile[]
  colorProfileId: string
  colorProfiles: ColorProfile[]
  settings: SessionSettings
}

export interface SessionFile {
  id: string
  filePath: string
  fileName: string
  colorProfileId: string
  collapsedGroups: string[]   // group ids
  collapsedDays: string[]
  selectedEntryId?: string
}

export interface SessionSettings {
  correlationWindowSize: number    // default 10
  fuzzyThreshold: number           // 0–1, default 0.4
  autoCollapseThreshold: number    // repeat count before auto-collapse
  showNonSignificant: boolean
  correlationWindowOpen: boolean
}

// ── IPC channel names ─────────────────────────────────────────────────────
export const IPC = {
  PARSE_LOG: 'parse-log',
  PARSE_LOG_PROGRESS: 'parse-log-progress',
  OPEN_FILE_DIALOG: 'open-file-dialog',
  SAVE_SESSION: 'save-session',
  LOAD_SESSION: 'load-session',
  GET_RECENT_SESSIONS: 'get-recent-sessions',
  DELETE_SESSION: 'delete-session',
  EXPORT_LOG: 'export-log',
  CHECK_FOR_UPDATES: 'check-for-updates',
  SHOW_CONTEXT_MENU: 'show-context-menu',
  GET_APP_VERSION: 'get-app-version'
} as const

