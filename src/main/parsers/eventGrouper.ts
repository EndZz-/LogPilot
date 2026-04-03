import { randomUUID } from 'crypto'
import { LogEntry, EventGroup } from '../../shared/types'

// Strip dynamic tokens (IDs, IPs, numbers, hex strings, UUIDs) to get a canonical template
export function templateize(message: string): string {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>')
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?\b/g, '<IP>')
    .replace(/https?:\/\/[^\s"']+/g, '<URL>')
    .replace(/\b[A-Za-z]:\\[^\s"']+/g, '<PATH>')
    .replace(/\/[a-zA-Z0-9/_.-]{3,}/g, '<PATH>')
    .replace(/\b0x[0-9a-fA-F]+\b/g, '<HEX>')
    .replace(/\b\d{4,}\b/g, '<NUM>')          // long numbers (IDs, ports, etc.)
    .replace(/\b\d+\.\d+\b/g, '<DEC>')        // decimals
    .replace(/\b\d{1,3}\b/g, '<N>')           // short numbers
    .replace(/["'][^"']{0,120}["']/g, '<STR>') // quoted strings
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// Simple Levenshtein ratio for two short strings
function similarity(a: string, b: string): number {
  if (a === b) return 1
  const la = a.length, lb = b.length
  if (la === 0 || lb === 0) return 0
  // For performance, cap at 300 chars
  const ta = a.slice(0, 300), tb = b.slice(0, 300)
  const dp: number[] = Array.from({ length: tb.length + 1 }, (_, i) => i)
  for (let i = 1; i <= ta.length; i++) {
    let prev = i
    for (let j = 1; j <= tb.length; j++) {
      const val = ta[i - 1] === tb[j - 1] ? dp[j - 1] : Math.min(dp[j - 1], dp[j], prev) + 1
      dp[j - 1] = prev
      prev = val
    }
    dp[tb.length] = prev
  }
  const dist = dp[tb.length]
  return 1 - dist / Math.max(ta.length, tb.length)
}

export function groupEntries(
  entries: LogEntry[],
  fuzzyThreshold = 0.55
): EventGroup[] {
  // First pass: exact template matching (fast path)
  const exactMap = new Map<string, LogEntry[]>()
  for (const entry of entries) {
    const key = `${entry.level ?? ''}|${entry.source ?? ''}|${templateize(entry.message)}`
    if (!exactMap.has(key)) exactMap.set(key, [])
    exactMap.get(key)!.push(entry)
  }

  // Convert exact groups
  const groups: Array<{ template: string; entries: LogEntry[]; level: string | null; source: string | null }> = []
  for (const [key, grpEntries] of exactMap) {
    const [level, source, ...templateParts] = key.split('|')
    groups.push({ template: templateParts.join('|'), entries: grpEntries, level: level || null, source: source || null })
  }

  // Second pass: fuzzy merge — merge groups whose templates are similar
  const merged: typeof groups = []
  const used = new Set<number>()

  for (let i = 0; i < groups.length; i++) {
    if (used.has(i)) continue
    const base = { ...groups[i], entries: [...groups[i].entries] }
    for (let j = i + 1; j < groups.length; j++) {
      if (used.has(j)) continue
      if (base.level !== groups[j].level) continue // don't merge across levels
      const sim = similarity(base.template, groups[j].template)
      if (sim >= fuzzyThreshold) {
        base.entries.push(...groups[j].entries)
        used.add(j)
      }
    }
    used.add(i)
    merged.push(base)
  }

  // Sort within each group by timestamp
  return merged.map((g) => {
    const sorted = g.entries.sort((a, b) => {
      if (!a.timestamp) return 1
      if (!b.timestamp) return -1
      return a.timestamp.getTime() - b.timestamp.getTime()
    })
    const firstSeen = sorted.find(e => e.timestamp)?.timestamp ?? null
    const lastArr = [...sorted].reverse()
    const lastSeen = lastArr.find(e => e.timestamp)?.timestamp ?? null
    return {
      id: randomUUID(),
      template: g.template,
      level: (g.level as EventGroup['level']) || null,
      source: g.source,
      entries: sorted,
      count: sorted.length,
      firstSeen,
      lastSeen,
      color: undefined,
      collapsed: g.entries.length > 3,   // auto-collapse if >3 occurrences
      significant: g.entries.length <= 10 // auto-flag high-count groups as non-significant
    } satisfies EventGroup
  }).sort((a, b) => {
    if (!a.firstSeen) return 1
    if (!b.firstSeen) return -1
    return a.firstSeen.getTime() - b.firstSeen.getTime()
  })
}

