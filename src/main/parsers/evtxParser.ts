import { execFile } from 'child_process'
import { randomUUID } from 'crypto'
import { tmpdir } from 'os'
import { join } from 'path'
import { rmSync } from 'fs'
import { LogEntry, LogLevel, ParsedLog, DayBucket } from '../../shared/types'
import { groupEntries } from './eventGrouper'

// Map Windows event Level integers to our LogLevel
function mapWindowsLevel(level: number, keywords: string): LogLevel {
  if (keywords?.includes('Audit Failure')) return 'ERROR'
  if (keywords?.includes('Audit Success')) return 'INFO'
  switch (level) {
    case 1: return 'CRITICAL'
    case 2: return 'ERROR'
    case 3: return 'WARN'
    case 4: return 'INFO'
    case 5: return 'DEBUG'
    default: return 'UNKNOWN'
  }
}

// PowerShell script read via $env:EVTX_PATH (avoids -Command arg parsing issues).
// Copies to temp first so locked system logs (Application, System, etc.) can be read.
const PS_SCRIPT = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$src = $env:EVTX_PATH
$tmp = $env:EVTX_TMP
try { Copy-Item -Path $src -Destination $tmp -Force -ErrorAction Stop } catch { $tmp = $src }
try {
  $events = Get-WinEvent -Path $tmp -ErrorAction Stop
} catch {
  Write-Error $_
  exit 1
}
$i = 0
$total = $events.Count
foreach ($e in $events) {
  $i++
  $fullMsg = if ($e.Message) { $e.Message.Trim() } else { "" }
  $firstLine = if ($fullMsg) { ($fullMsg -split "[\\r\\n]+")[0].Trim() } else { "Event ID $($e.Id)" }
  [PSCustomObject]@{
    id           = $e.Id
    level        = [int]$e.Level
    levelName    = $e.LevelDisplayName
    timeCreated  = $e.TimeCreated.ToString("o")
    providerName = $e.ProviderName
    summary      = $firstLine
    fullMessage  = ($fullMsg -replace "[\\r\\n]+", " ").Trim()
    keywords     = ($e.KeywordsDisplayNames -join ",")
    index        = $i
    total        = $total
  } | ConvertTo-Json -Compress
}
`.trim()

export async function parseEvtxFile(
  filePath: string,
  onProgress?: (pct: number) => void
): Promise<ParsedLog> {
  const entries: LogEntry[] = []
  const tmpPath = join(tmpdir(), `logpilot-${randomUUID()}.evtx`)

  try {
    await new Promise<void>((resolve, reject) => {
      const proc = execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', PS_SCRIPT],
        {
          maxBuffer: 512 * 1024 * 1024,
          encoding: 'utf8',
          env: { ...process.env, EVTX_PATH: filePath, EVTX_TMP: tmpPath }
        },
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
            // summary = first line of event message, used for display
            // fullMessage = full collapsed text, kept in raw for search/copy
            const summary: string = obj.summary || `Event ID ${obj.id}`
            const fullMessage: string = obj.fullMessage || summary
            const source: string = obj.providerName ?? ''
            // Shorten provider names like "Microsoft-Windows-Security-Auditing" → "Security-Auditing"
            const shortSource = source.replace(/^Microsoft-Windows-/i, '').replace(/^Microsoft-/i, '')

            entries.push({
              id: randomUUID(),
              raw: `[${obj.levelName ?? level}] [${source}] [EventID:${obj.id}] ${fullMessage}`,
              timestamp,
              level,
              source: shortSource || source,
              message: `[${obj.id}] ${summary}`,
              lineNumber: Number(obj.index)
            })

            if (onProgress && obj.total > 0 && Number(obj.index) % 200 === 0) {
              onProgress(Math.min(99, Math.round((Number(obj.index) / Number(obj.total)) * 100)))
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      })
    })
  } finally {
    // Clean up temp copy
    try { rmSync(tmpPath) } catch { /* ignore */ }
  }

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
