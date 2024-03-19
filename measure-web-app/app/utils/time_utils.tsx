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

  return output.trim().replace(/, $/, ''); // Remove trailing comma if any
}

export function formatDateToHumanReadable(timestamp: string) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const utcDate = new Date(timestamp);
  const localDate = new Date(utcDate.getTime() - utcDate.getTimezoneOffset() * 60000);
  const month = months[localDate.getMonth()];
  const day = localDate.getDate();
  const year = localDate.getFullYear();
  const dayOfWeek = days[localDate.getDay()];
  const suffix = getDaySuffix(day);

  return `${dayOfWeek}, ${day}${suffix} ${month}, ${year}`;
}

function getDaySuffix(day: number): string {
  const lastDigit = day % 10;
  const lastTwoDigits = day % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return 'th';
  }

  switch (lastDigit) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

export function formatTimeToHumanReadable(timestamp: string): string {
  const utcDate = new Date(timestamp);
  const localDate = new Date(utcDate.getTime() - utcDate.getTimezoneOffset() * 60000);
  const hours = localDate.getHours();
  const minutes = localDate.getMinutes();
  const seconds = localDate.getSeconds();
  const milliseconds = localDate.getMilliseconds();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const formattedHours = hours % 12 === 0 ? 12 : hours % 12;

  return `${formattedHours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${milliseconds.toString().padStart(3, '0')} ${ampm}`;
}

export function formatTimestampToChartFormat(dateString: string): string {
  const utcDate = new Date(dateString);
  const localDate = new Date(utcDate.getTime() - utcDate.getTimezoneOffset() * 60000);
  const year = localDate.getFullYear();
  const month = localDate.getMonth() + 1; // Months are zero-based
  const day = localDate.getDate();
  const hours = localDate.getHours();
  const minutes = localDate.getMinutes();
  const seconds = localDate.getSeconds();
  const milliseconds = localDate.getMilliseconds();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const formattedHours = hours % 12 === 0 ? 12 : hours % 12;

  const formattedMonth = month.toString().padStart(2, '0');
  const formattedDay = day.toString().padStart(2, '0');
  const formattedMinutes = minutes.toString().padStart(2, '0');
  const formattedSeconds = seconds.toString().padStart(2, '0');
  const formattedMilliseconds = milliseconds.toString().padStart(3, '0');
  const formattedHours12 = formattedHours.toString().padStart(2, '0');

  return `${year}-${formattedMonth}-${formattedDay} ${formattedHours12}:${formattedMinutes}:${formattedSeconds}:${formattedMilliseconds} ${ampm}`;
}
