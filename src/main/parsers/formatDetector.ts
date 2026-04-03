import { statSync, createReadStream } from 'fs'
import { createInterface } from 'readline'
import { LogFormat } from '../../shared/types'

export type DateOrder = 'MDY' | 'DMY'

const FORMAT_PATTERNS: Array<{ format: LogFormat; regex: RegExp }> = [
  // JSON log (each line is JSON)
  { format: 'json',          regex: /^\s*\{.*"(level|severity|msg|message|time|timestamp)"/ },
  // Python logging: INFO:module:message or YYYY-MM-DD ... - INFO - msg
  { format: 'python',        regex: /^[A-Z]+:[A-Za-z._]+:|^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d+ - / },
  // Apache combined/common log
  { format: 'apache',        regex: /^\d+\.\d+\.\d+\.\d+ - .+\[.+\] "(GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH)/ },
  // Nginx
  { format: 'nginx',         regex: /^\d+\.\d+\.\d+\.\d+ - .+\[.+\] "(GET|POST|PUT|DELETE).*" \d{3} \d+/ },
  // Syslog
  { format: 'syslog',        regex: /^[A-Z][a-z]{2} [ \d]\d \d{2}:\d{2}:\d{2} \S+ \S+(\[\d+\])?:/ },
  // Windows Event (evt/evtx text export)
  { format: 'windows-event', regex: /^(Log Name|Source|Date|Event ID|Task Category|Level|Keywords|User|Computer):\s/ },
  // Log4j/log4net pattern
  { format: 'log4j',         regex: /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.,]\d+ +(TRACE|DEBUG|INFO|WARN|ERROR|FATAL) / }
]

export async function detectFormat(filePath: string): Promise<{ size: number; format: LogFormat; dateOrder: DateOrder }> {
  const stats = statSync(filePath)
  const size = stats.size

  // Sample first 100 non-empty lines to detect format and date order
  const sample: string[] = []
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath, { encoding: 'utf8', end: Math.min(size, 131072) })
    const rl = createInterface({ input: stream, crlfDelay: Infinity })
    rl.on('line', (line) => {
      if (line.trim()) sample.push(line)
      if (sample.length >= 100) { rl.close(); stream.destroy() }
    })
    rl.on('close', resolve)
    rl.on('error', reject)
    stream.on('error', resolve) // destroyed intentionally
  })

  const format = detectFormatFromSample(sample)
  const dateOrder = detectDateOrder(sample)
  return { size, format, dateOrder }
}

/**
 * Detect whether ambiguous numeric dates (dd/mm/yyyy or mm/dd/yyyy) are DMY or MDY.
 * Strategy: if ANY date has a first component > 12 it MUST be the day → DMY.
 * If no definitive evidence found, default to MDY (JS Date default).
 */
function detectDateOrder(lines: string[]): DateOrder {
  // Match ambiguous patterns: NN/NN/YYYY or NN-NN-YYYY (not ISO, not Apache)
  const ambiguous = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/
  let dmyEvidence = 0
  let mdyEvidence = 0

  for (const line of lines) {
    const m = line.match(ambiguous)
    if (!m) continue
    const first = parseInt(m[1], 10)
    const second = parseInt(m[2], 10)
    if (first > 12) dmyEvidence++       // first component can't be a month → DMY
    else if (second > 12) mdyEvidence++ // second component can't be a month → MDY
  }

  if (dmyEvidence > 0 && dmyEvidence >= mdyEvidence) return 'DMY'
  return 'MDY'
}

function detectFormatFromSample(lines: string[]): LogFormat {
  const scores = new Map<LogFormat, number>()

  for (const line of lines) {
    for (const { format, regex } of FORMAT_PATTERNS) {
      if (regex.test(line)) {
        scores.set(format, (scores.get(format) ?? 0) + 1)
      }
    }
  }

  if (scores.size === 0) return 'generic'

  let best: LogFormat = 'generic'
  let bestScore = 0
  for (const [format, score] of scores) {
    if (score > bestScore) { bestScore = score; best = format }
  }

  // Need at least 20% of sample lines to match
  return bestScore >= Math.max(1, lines.length * 0.2) ? best : 'generic'
}

