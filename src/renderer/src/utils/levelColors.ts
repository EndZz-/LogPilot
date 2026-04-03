import { LogLevel } from '../../../shared/types'

export const DEFAULT_LEVEL_COLORS: Record<LogLevel, string> = {
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

export function getLevelColor(
  level: LogLevel | null,
  overrides?: Partial<Record<LogLevel, string>>
): string {
  if (!level) return DEFAULT_LEVEL_COLORS.UNKNOWN
  return overrides?.[level] ?? DEFAULT_LEVEL_COLORS[level] ?? DEFAULT_LEVEL_COLORS.UNKNOWN
}

export const LEVEL_SORT_ORDER: Record<LogLevel, number> = {
  FATAL: 0, CRITICAL: 1, ERROR: 2, WARN: 3, WARNING: 4,
  NOTICE: 5, INFO: 6, DEBUG: 7, TRACE: 8, UNKNOWN: 9
}

