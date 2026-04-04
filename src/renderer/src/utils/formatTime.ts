/**
 * Shared timestamp formatting utilities.
 * All time display in the app should go through these functions
 * so the 12hr/24hr setting is applied consistently everywhere.
 */

/**
 * Format a time-only string: "12:30:45 PM" (12hr) or "12:30:45" (24hr).
 * Uses en-US locale for consistent output regardless of system locale.
 */
export function formatTimeOnly(ts: Date, use24Hour: boolean): string {
  return ts.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: !use24Hour,
  })
}

/**
 * Format a date+time string: "04/03 12:30:45 PM" (12hr) or "04/03 12:30:45" (24hr).
 */
export function formatDateTime(ts: Date, use24Hour: boolean): string {
  const mm = String(ts.getMonth() + 1).padStart(2, '0')
  const dd = String(ts.getDate()).padStart(2, '0')
  return `${mm}/${dd} ${formatTimeOnly(ts, use24Hour)}`
}
