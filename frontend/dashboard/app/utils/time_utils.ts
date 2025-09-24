import { DateTime } from 'luxon'

export function getTimeZoneForServer(): string {
  return DateTime.now().zone.name
}

export function formatMillisToHumanReadable(millis: number) {
  if (millis <= 0) return '0ms'

  // Round ms for sub-second values
  if (millis < 1000) return `${Math.round(millis)}ms`

  const msPerSecond = 1000
  const secPerMinute = 60
  const minPerHour = 60
  const hrPerDay = 24

  let remaining = millis

  const days = Math.floor(remaining / (msPerSecond * secPerMinute * minPerHour * hrPerDay))
  remaining %= msPerSecond * secPerMinute * minPerHour * hrPerDay

  const hours = Math.floor(remaining / (msPerSecond * secPerMinute * minPerHour))
  remaining %= msPerSecond * secPerMinute * minPerHour

  const minutes = Math.floor(remaining / (msPerSecond * secPerMinute))
  remaining %= msPerSecond * secPerMinute

  // For exact minute/hour/day, don't show seconds
  const seconds = remaining / msPerSecond

  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)

  // Only show seconds if not an exact minute/hour/day
  if (seconds > 0 || parts.length === 0) {
    // Remove trailing zeros for decimals, but always show up to 3 decimals if needed
    const secStr = seconds % 1 === 0 ? seconds.toFixed(0) : seconds.toFixed(3).replace(/\.?0+$/, '')
    parts.push(`${secStr}s`)
  }

  return parts.join(' ')
}

export function formatDateToHumanReadableDateTime(timestamp: string): string {
  const utcDateTime = DateTime.fromISO(timestamp)

  if (!utcDateTime.isValid) {
    throw (utcDateTime.invalidReason)
  }

  const localDateTime = utcDateTime.toLocal()

  return localDateTime.toFormat('d MMM, yyyy, h:mm:ss a')
}

export function formatDateToHumanReadableDate(timestamp: string): string {
  const utcDateTime = DateTime.fromISO(timestamp)

  if (!utcDateTime.isValid) {
    throw (utcDateTime.invalidReason)
  }

  const localDateTime = utcDateTime.toLocal()

  return localDateTime.toFormat('d MMM, yyyy')
}

export function formatDateToHumanReadableTime(timestamp: string): string {
  const utcDateTime = DateTime.fromISO(timestamp)

  if (!utcDateTime.isValid) {
    throw (utcDateTime.invalidReason)
  }

  const localDateTime = utcDateTime.toLocal()

  return localDateTime.toFormat('h:mm:ss a')
}

export function formatTimestampToChartFormat(timestamp: string): string {
  const utcDateTime = DateTime.fromISO(timestamp)

  if (!utcDateTime.isValid) {
    throw (utcDateTime.invalidReason)
  }

  const localDateTime = utcDateTime.toLocal()
  const formattedDate = localDateTime.toFormat('yyyy-MM-dd HH:mm:ss:SSS a')
  return formattedDate
}

export function formatChartFormatTimestampToHumanReadable(timestamp: string): string {
  const localDateTime = DateTime.fromFormat(timestamp, 'yyyy-MM-dd hh:mm:ss:SSS a')

  if (!localDateTime.isValid) {
    throw (localDateTime.invalidReason)
  }

  const dayOfWeek = localDateTime.weekdayShort
  const month = localDateTime.monthShort
  const year = localDateTime.year

  return `${dayOfWeek}, ${localDateTime.toFormat('d')} ${month}, ${year}, ` + localDateTime.toFormat('h:mm:ss:SSS a')
}

export function formatUserInputDateToServerFormat(timestamp: string): string {
  let localDateTime = DateTime.fromISO(timestamp)

  if (!localDateTime.isValid) {
    throw (localDateTime.invalidReason)
  }

  return localDateTime.toUTC().toISO()!
}

export function formatIsoDateForDateTimeInputField(timestamp: string): string {
  const utcDateTime = DateTime.fromISO(timestamp)

  if (!utcDateTime.isValid) {
    throw (utcDateTime.invalidReason)
  }

  const localDateTime = utcDateTime.toLocal()

  const dateTimeInputFormat = "yyyy-MM-dd'T'HH:mm"
  return localDateTime.toFormat(dateTimeInputFormat)!

}

export function isValidTimestamp(timestamp: string): boolean {
  const utcDateTime = DateTime.fromISO(timestamp)
  return utcDateTime.isValid
}
