export function formatCompactNumber(value?: number): string {
  if (value == null) {
    return '0'
  }

  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatPostedDate(value?: string | null): string {
  if (!value) {
    return 'Unknown date'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
  }).format(date)
}
