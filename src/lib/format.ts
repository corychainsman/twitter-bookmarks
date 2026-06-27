const compactNumberFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})
const compactNumberCache = new Map<number, string>()

export function formatCompactNumber(value?: number): string {
  if (value == null) {
    return '0'
  }

  const cached = compactNumberCache.get(value)
  if (cached) return cached
  const formatted = compactNumberFormatter.format(value)
  compactNumberCache.set(value, formatted)
  return formatted
}

const postedDateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })
const postedDateCache = new Map<string, string>()
const postedTimeFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })
const postedDateTimeCache = new Map<string, string>()

export function formatPostedDate(value?: string | null): string {
  if (!value) {
    return 'Unknown date'
  }

  const cached = postedDateCache.get(value)
  if (cached) return cached
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  const formatted = postedDateFormatter.format(date)
  postedDateCache.set(value, formatted)
  return formatted
}

export function formatPostedDateTime(value?: string | null): string {
  if (!value) {
    return 'Unknown date'
  }

  const cached = postedDateTimeCache.get(value)
  if (cached) return cached
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  const time = postedTimeFormatter.format(date)
  const day = postedDateFormatter.format(date)

  const formatted = `${time} · ${day}`
  postedDateTimeCache.set(value, formatted)
  return formatted
}
