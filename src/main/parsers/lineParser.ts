import { randomUUID } from 'crypto'
import { LogEntry, LogFormat, LogLevel } from '../../shared/types'
import { DateOrder } from './formatDetector'

// Generic timestamp patterns (ordered most specific → least)
const TIMESTAMP_PATTERNS = [
  /(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/,
  /(\d{2}\/[A-Za-z]{3}\/\d{4}:\d{2}:\d{2}:\d{2} [+-]\d{4})/,  // Apache
  /([A-Z][a-z]{2} [ \d]\d \d{2}:\d{2}:\d{2})/,                  // syslog
  /(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2})/,
  /(\d{10,13})/                                                   // unix epoch (last resort)
]

const LEVEL_PATTERN = /\b(TRACE|DEBUG|INFO|NOTICE|WARN(?:ING)?|ERROR|CRITICAL|FATAL|SEVERE)\b/i

export function parseLineForFormat(raw: string, lineNumber: number, format: LogFormat, dateOrder: DateOrder = 'MDY'): LogEntry {
  switch (format) {
    case 'json':          return parseJsonLine(raw, lineNumber, dateOrder)
    case 'apache':
    case 'nginx':         return parseApacheLine(raw, lineNumber, format)
    case 'python':        return parsePythonLine(raw, lineNumber, dateOrder)
    case 'syslog':        return parseSyslogLine(raw, lineNumber)
    case 'windows-event': return parseWindowsEventLine(raw, lineNumber)
    case 'log4j':         return parseGenericLine(raw, lineNumber, dateOrder)
    default:              return parseGenericLine(raw, lineNumber, dateOrder)
  }
}

function parseGenericLine(raw: string, lineNumber: number, dateOrder: DateOrder = 'MDY'): LogEntry {
  let timestamp: Date | null = null
  for (const pattern of TIMESTAMP_PATTERNS) {
    const m = raw.match(pattern)
    if (m) { timestamp = safeParse(m[1], dateOrder); if (timestamp) break }
  }

  const levelMatch = raw.match(LEVEL_PATTERN)
  const level = levelMatch ? normalizeLevel(levelMatch[1]) : null

  // Source: text inside [] after timestamp
  const srcMatch = raw.match(/\[([A-Za-z0-9_./-]{2,40})\]/)
  const source = srcMatch ? srcMatch[1] : null

  const message = extractMessage(raw)

  return { id: randomUUID(), raw, timestamp, level, source, message, lineNumber }
}

function parseJsonLine(raw: string, lineNumber: number, dateOrder: DateOrder = 'MDY'): LogEntry {
  try {
    const obj = JSON.parse(raw)
    const message = obj.message ?? obj.msg ?? obj.text ?? raw
    const level = normalizeLevel(obj.level ?? obj.severity ?? obj.lvl ?? '')
    const tsRaw = obj.timestamp ?? obj.time ?? obj['@timestamp'] ?? obj.ts
    const timestamp = tsRaw ? safeParse(String(tsRaw), dateOrder) : null
    const source = obj.logger ?? obj.name ?? obj.module ?? null
    return { id: randomUUID(), raw, timestamp, level, source, message: String(message), lineNumber }
  } catch {
    return parseGenericLine(raw, lineNumber, dateOrder)
  }
}

function parseApacheLine(raw: string, lineNumber: number, _format: LogFormat): LogEntry {
  // combined: ip - user [date] "method path proto" status size "referer" "ua"
  const m = raw.match(/^(\S+) \S+ \S+ \[([^\]]+)\] "([^"]*)" (\d{3})/)
  if (!m) return parseGenericLine(raw, lineNumber)
  const timestamp = safeParse(m[2].replace(':', ' ').replace(' +', '+'))
  const statusCode = parseInt(m[4])
  const level: LogLevel = statusCode >= 500 ? 'ERROR' : statusCode >= 400 ? 'WARN' : 'INFO'
  return { id: randomUUID(), raw, timestamp, level, source: m[1], message: m[3], lineNumber }
}

function parsePythonLine(raw: string, lineNumber: number, dateOrder: DateOrder = 'MDY'): LogEntry {
  // Format: LEVEL:logger:message  OR  date,ms - LEVEL - message
  const m1 = raw.match(/^([A-Z]+):([^:]+):(.+)$/)
  if (m1) {
    return { id: randomUUID(), raw, timestamp: null, level: normalizeLevel(m1[1]), source: m1[2], message: m1[3].trim(), lineNumber }
  }
  return parseGenericLine(raw, lineNumber, dateOrder)
}

function parseSyslogLine(raw: string, lineNumber: number): LogEntry {
  const m = raw.match(/^([A-Z][a-z]{2} [ \d]\d \d{2}:\d{2}:\d{2}) (\S+) (\S+?)(?:\[(\d+)\])?:\s*(.*)$/)
  if (!m) return parseGenericLine(raw, lineNumber)
  const timestamp = safeParse(`${new Date().getFullYear()} ${m[1]}`)
  const source = m[3]
  const levelMatch = m[5].match(LEVEL_PATTERN)
  const level = levelMatch ? normalizeLevel(levelMatch[1]) : null
  return { id: randomUUID(), raw, timestamp, level, source, message: m[5], lineNumber }
}

function parseWindowsEventLine(raw: string, lineNumber: number): LogEntry {
  return parseGenericLine(raw, lineNumber)
}

function extractMessage(raw: string): string {
  // Strip leading timestamp and level tokens to get the actual message
  let msg = raw
  for (const p of TIMESTAMP_PATTERNS) msg = msg.replace(p, '').trim()
  msg = msg.replace(LEVEL_PATTERN, '').replace(/^\s*[\[\]|:,\-]+\s*/, '').trim()
  return msg || raw.trim()
}

export function normalizeLevel(raw: string): LogLevel {
  const up = raw.toUpperCase()
  const map: Record<string, LogLevel> = {
    TRACE: 'TRACE', DEBUG: 'DEBUG', INFO: 'INFO', NOTICE: 'NOTICE',
    WARN: 'WARN', WARNING: 'WARNING', ERROR: 'ERROR',
    CRITICAL: 'CRITICAL', FATAL: 'FATAL', SEVERE: 'FATAL'
  }
  return map[up] ?? 'UNKNOWN'
}

// Matches ambiguous NN/NN/YYYY or NN-NN-YYYY (not ISO, not Apache month abbrev)
const AMBIGUOUS_DATE_RE = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(.*)$/

function safeParse(s: string, dateOrder: DateOrder = 'MDY'): Date | null {
  if (!s) return null
  // Unix epoch?
  if (/^\d{10}$/.test(s)) return new Date(parseInt(s) * 1000)
  if (/^\d{13}$/.test(s)) return new Date(parseInt(s))

  // Handle ambiguous numeric dates (DD/MM/YYYY vs MM/DD/YYYY)
  const ambMatch = s.match(AMBIGUOUS_DATE_RE)
  if (ambMatch && dateOrder === 'DMY') {
    const [, first, second, year, rest] = ambMatch
    // Swap day and month: construct as YYYY-MM-DD (ISO) so JS parses it correctly
    const isoLike = `${year}-${second.padStart(2, '0')}-${first.padStart(2, '0')}${rest}`
    const d = new Date(isoLike)
    return isNaN(d.getTime()) ? null : d
  }

  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

