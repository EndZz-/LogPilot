import { execFile } from 'child_process'
import { randomUUID } from 'crypto'
import { LogEntry, LogLevel, ParsedLog, DayBucket } from '../../shared/types'
import { groupEntries } from './eventGrouper'

// Map Windows event Level integers to our LogLevel
function mapWindowsLevel(level: number, keywords: string): LogLevel {
  // Keywords field contains "Audit Success" / "Audit Failure" for security events
  if (keywords?.includes('Audit Failure')) return 'ERROR'
  if (keywords?.includes('Audit Success')) return 'INFO'
  switch (level) {
    case 1: return 'CRITICAL'   // Critical
    case 2: return 'ERROR'      // Error
    case 3: return 'WARN'       // Warning
    case 4: return 'INFO'       // Information
    case 5: return 'DEBUG'      // Verbose
    default: return 'UNKNOWN'
  }
}

// PowerShell script: export each event as a JSON line to stdout
const PS_SCRIPT = `
$events = Get-WinEvent -Path $args[0] -ErrorAction SilentlyContinue
if (-not $events) { exit 0 }
$i = 0
$total = $events.Count
foreach ($e in $events) {
  $i++
  [PSCustomObject]@{
    id         = $e.Id
    level      = $e.Level
    levelName  = $e.LevelDisplayName
    timeCreated = $e.TimeCreated.ToString('o')
    providerName = $e.ProviderName
    message    = ($e.Message -replace '[\\r\\n]+', ' ').Trim()
    keywords   = $e.KeywordsDisplayNames -join ','
    computerName = $e.MachineName
    index      = $i
    total      = $total
  } | ConvertTo-Json -Compress
}
`.trim()

export async function parseEvtxFile(
  filePath: string,
  onProgress?: (pct: number) => void
): Promise<ParsedLog> {
  const entries: LogEntry[] = []

  await new Promise<void>((resolve, reject) => {
    const proc = execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', PS_SCRIPT, filePath],
      { maxBuffer: 512 * 1024 * 1024 },
      (err) => {
        if (err && entries.length === 0) reject(err)
        else resolve()
      }
    )

    let leftover = ''
    proc.stdout?.on('data', (chunk: string) => {
      const lines = (leftover + chunk).split('\n')
      leftover = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const obj = JSON.parse(trimmed)
          const timestamp = obj.timeCreated ? new Date(obj.timeCreated) : null
          const level = mapWindowsLevel(Number(obj.level), String(obj.keywords ?? ''))
          const message = obj.message || `Event ID ${obj.id}`
          const source = obj.providerName ?? null

          entries.push({
            id: randomUUID(),
            raw: `[${obj.levelName ?? level}] [${source}] [EventID:${obj.id}] ${message}`,
            timestamp,
            level,
            source,
            message,
            lineNumber: Number(obj.index)
          })

          // Report progress based on index/total from each event
          if (onProgress && obj.total > 0 && Number(obj.index) % 200 === 0) {
            onProgress(Math.min(99, Math.round((Number(obj.index) / Number(obj.total)) * 100)))
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    })
  })

  onProgress?.(100)

  const buckets = groupEvtxIntoBuckets(entries)

  return {
    id: randomUUID(),
    fileName: filePath.split(/[\\/]/).pop() ?? filePath,
    filePath,
    format: 'evtx',
    totalLines: entries.length,
    totalEntries: entries.length,
    buckets,
    colorProfile: {
      id: 'default',
      name: 'Default',
      rules: [],
      levelColors: {
        CRITICAL: '#f43f5e',
        ERROR:    '#f87171',
        WARN:     '#fbbf24',
        INFO:     '#34d399',
        DEBUG:    '#60a5fa',
        UNKNOWN:  '#9ca3af'
      }
    },
    loadedAt: new Date()
  }
}

function groupEvtxIntoBuckets(entries: LogEntry[]): DayBucket[] {
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

  buckets.sort((a, b) => {
    if (a.date === 'Unknown') return 1
    if (b.date === 'Unknown') return -1
    return a.date.localeCompare(b.date)
  })

  return buckets
}
