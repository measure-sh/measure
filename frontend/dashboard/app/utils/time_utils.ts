import { DateTime } from 'luxon';

export function formatMillisToHumanReadable(millis: number) {
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
  if (millis > 0) output += `${millis}ms`;

  return output.trim().replace(/,\s*$/, ''); // Remove trailing comma if any
}

export function formatDateToHumanReadable(timestamp: string): string {
  const utcDateTime = DateTime.fromISO(timestamp, { zone: 'utc' });

  if (!utcDateTime.isValid) {
    throw (utcDateTime.invalidReason)
  }

  const localDateTime = utcDateTime.toLocal();

  const dayOfWeek = localDateTime.weekdayShort;
  const month = localDateTime.monthShort;
  const year = localDateTime.year;

  return `${dayOfWeek}, ${localDateTime.toFormat('d')} ${month}, ${year}`;
}

export function formatTimeToHumanReadable(timestamp: string): string {
  const utcDateTime = DateTime.fromISO(timestamp, { zone: 'utc' });

  if (!utcDateTime.isValid) {
    throw (utcDateTime.invalidReason)
  }

  const localDateTime = utcDateTime.toLocal();

  return localDateTime.toFormat('h:mm:ss:SSS a');
}

export function formatTimestampToChartFormat(timestamp: string): string {
  const utcDateTime = DateTime.fromISO(timestamp, { zone: 'utc' });

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

export enum UserInputDateType {
  From,
  To
}

export function formatUserInputDateToServerFormat(date: string, inputDateType: UserInputDateType): string {
  // Parse date string, time will be 00:00:00 
  let localDateTime = DateTime.fromFormat(date, 'yyyy-MM-dd')

  // Throw error if invalid
  if (!localDateTime.isValid) {
    throw (localDateTime.invalidReason)
  }

  // If "To" date, set time to end of day to include whole of the day
  if (inputDateType === UserInputDateType.To) {
    localDateTime = localDateTime.plus({ hours: 23, minutes: 59, seconds: 59, milliseconds: 999 })
  }

  return localDateTime.toUTC().toISO()!
}

export function isValidTimestamp(timestamp: string): boolean {
  const utcDateTime = DateTime.fromISO(timestamp, { zone: 'utc' });
  return utcDateTime.isValid
}
