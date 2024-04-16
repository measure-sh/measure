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
  const localDateTime = utcDateTime.toLocal();

  const dayOfWeek = localDateTime.weekdayShort;
  const month = localDateTime.monthShort;
  const year = localDateTime.year;

  return `${dayOfWeek}, ${localDateTime.toFormat('d')} ${month}, ${year}`;
}

export function formatTimeToHumanReadable(timestamp: string): string {
  const utcDateTime = DateTime.fromISO(timestamp, { zone: 'utc' });
  const localDateTime = utcDateTime.toLocal();

  return localDateTime.toFormat('h:mm:ss:SSS a');
}

export function formatTimestampToChartFormat(timestamp: string): string {
  const utcDateTime = DateTime.fromISO(timestamp, { zone: 'utc' });
  const localDateTime = utcDateTime.toLocal();
  const formattedDate = localDateTime.toFormat('yyyy-MM-dd HH:mm:ss.SSS a');
  return formattedDate
}
