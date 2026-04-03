import { createReadStream } from 'fs'
import { createInterface } from 'readline'
import { randomUUID } from 'crypto'
import {
  LogEntry, LogFormat, LogLevel, ParsedLog, DayBucket, EventGroup, ColorProfile
} from '../../shared/types'
import { detectFormat } from './formatDetector'
import { parseLineForFormat } from './lineParser'
import { groupEntries } from './eventGrouper'
import { parseEvtxFile } from './evtxParser'

export async function parseLogFile(
  filePath: string,
  onProgress?: (pct: number) => void
): Promise<ParsedLog> {
  // Route .evtx binary files to the dedicated PowerShell-based parser
  if (filePath.toLowerCase().endsWith('.evtx')) {
    return parseEvtxFile(filePath, onProgress)
  }

  const { size, format, dateOrder } = await detectFormat(filePath)
  const entries: LogEntry[] = []
  let lineNumber = 0
  let bytesRead = 0

  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath, { encoding: 'utf8' })
    const rl = createInterface({ input: stream, crlfDelay: Infinity })

    rl.on('line', (line: string) => {
      lineNumber++
      bytesRead += Buffer.byteLength(line, 'utf8') + 1
      if (!line.trim()) return

      const entry = parseLineForFormat(line, lineNumber, format, dateOrder)
      entries.push(entry)

      if (onProgress && size > 0 && lineNumber % 500 === 0) {
        onProgress(Math.min(99, Math.round((bytesRead / size) * 100)))
      }
    })

    rl.on('close', resolve)
    rl.on('error', reject)
    stream.on('error', reject)
  })

  onProgress?.(100)

  const buckets = groupIntoBuckets(entries)
  const defaultProfile: ColorProfile = buildDefaultColorProfile()

  return {
    id: randomUUID(),
    fileName: filePath.split(/[\\/]/).pop() ?? filePath,
    filePath,
    format,
    totalLines: lineNumber,
    totalEntries: entries.length,
    buckets,
    colorProfile: defaultProfile,
    loadedAt: new Date()
  }
}

function groupIntoBuckets(entries: LogEntry[]): DayBucket[] {
  const dayMap = new Map<string, LogEntry[]>()

  for (const entry of entries) {
    const key = entry.timestamp
      ? entry.timestamp.toISOString().slice(0, 10)
      : 'Unknown'
    if (!dayMap.has(key)) dayMap.set(key, [])
    dayMap.get(key)!.push(entry)
  }

  const buckets: DayBucket[] = []
  for (const [date, dayEntries] of dayMap) {
    const groups = groupEntries(dayEntries)
    buckets.push({ date, groups, collapsed: false })
  }

  // Sort buckets: known dates first, then 'Unknown'
  buckets.sort((a, b) => {
    if (a.date === 'Unknown') return 1
    if (b.date === 'Unknown') return -1
    return a.date.localeCompare(b.date)
  })

  return buckets
}

function buildDefaultColorProfile(): ColorProfile {
  return {
    id: 'default',
    name: 'Default',
    rules: [],
    levelColors: {
      TRACE:    '#6b7280',
      DEBUG:    '#60a5fa',
      INFO:     '#34d399',
      NOTICE:   '#a3e635',
      WARN:     '#fbbf24',
      WARNING:  '#fbbf24',
      ERROR:    '#f87171',
      CRITICAL: '#f43f5e',
      FATAL:    '#ec4899',
      UNKNOWN:  '#9ca3af'
    }
  }
}

