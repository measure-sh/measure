import { DateTime } from 'luxon';

export function getTimeZoneForServer(): string {
  return DateTime.now().zone.name
}

export function formatMillisToHumanReadable(millis: number) {
  if (millis <= 0) {
    return '0ms'
  }

  const millisecondsPerSecond = 1000;
  const secondsPerMinute = 60;
  const minutesPerHour = 60;
  const hoursPerDay = 24;

  const days = Math.floor(millis / (millisecondsPerSecond * secondsPerMinute * minutesPerHour * hoursPerDay));
  millis %= millisecondsPerSecond * secondsPerMinute * minutesPerHour * hoursPerDay;

  const hours = Math.floor(millis / (millisecondsPerSecond * secondsPerMinute * minutesPerHour));
  millis %= millisecondsPerSecond * secondsPerMinute * minutesPerHour;

  const minutes = Math.floor(millis / (millisecondsPerSecond * secondsPerMinute));
  millis %= millisecondsPerSecond * secondsPerMinute;

  const seconds = Math.floor(millis / millisecondsPerSecond);
  millis %= millisecondsPerSecond;

  let output = '';
  if (days > 0) output += `${days}d, `;
  if (hours > 0) output += `${hours}h, `;
  if (minutes > 0) output += `${minutes}min, `;
  if (seconds > 0) output += `${seconds}s, `;
  if (millis > 0) output += `${Math.round(millis)}ms`;

  return output.trim().replace(/,\s*$/, ''); // Remove trailing comma if any
}

export function formatDateToHumanReadableDateTime(timestamp: string): string {
  const utcDateTime = DateTime.fromISO(timestamp);

  if (!utcDateTime.isValid) {
    throw (utcDateTime.invalidReason)
  }

  const localDateTime = utcDateTime.toLocal();

  return localDateTime.toFormat('d MMM, yyyy, h:mm:ss a');
}

export function formatDateToHumanReadableDate(timestamp: string): string {
  const utcDateTime = DateTime.fromISO(timestamp);

  if (!utcDateTime.isValid) {
    throw (utcDateTime.invalidReason)
  }

  const localDateTime = utcDateTime.toLocal();

  return localDateTime.toFormat('d MMM, yyyy');
}

export function formatDateToHumanReadableTime(timestamp: string): string {
  const utcDateTime = DateTime.fromISO(timestamp);

  if (!utcDateTime.isValid) {
    throw (utcDateTime.invalidReason)
  }

  const localDateTime = utcDateTime.toLocal();

  return localDateTime.toFormat('h:mm:ss a');
}

export function formatTimestampToChartFormat(timestamp: string): string {
  const utcDateTime = DateTime.fromISO(timestamp);

  if (!utcDateTime.isValid) {
    throw (utcDateTime.invalidReason)
  }

  const localDateTime = utcDateTime.toLocal();
  const formattedDate = localDateTime.toFormat('yyyy-MM-dd HH:mm:ss:SSS a');
  return formattedDate
}

export function formatChartFormatTimestampToHumanReadable(timestamp: string): string {
  const localDateTime = DateTime.fromFormat(timestamp, 'yyyy-MM-dd hh:mm:ss:SSS a')

  if (!localDateTime.isValid) {
    throw (localDateTime.invalidReason)
  }

  const dayOfWeek = localDateTime.weekdayShort;
  const month = localDateTime.monthShort;
  const year = localDateTime.year;

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
  const utcDateTime = DateTime.fromISO(timestamp);

  if (!utcDateTime.isValid) {
    throw (utcDateTime.invalidReason)
  }

  const localDateTime = utcDateTime.toLocal();

  const dateTimeInputFormat = "yyyy-MM-dd'T'HH:mm"
  return localDateTime.toFormat(dateTimeInputFormat)!

}

export function isValidTimestamp(timestamp: string): boolean {
  const utcDateTime = DateTime.fromISO(timestamp);
  return utcDateTime.isValid
}
