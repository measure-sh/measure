export function formatMillisToHumanRedable(millis: number) {
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
  if (days > 0) output += `${days} d, `;
  if (hours > 0) output += `${hours} h, `;
  if (minutes > 0) output += `${minutes} min, `;
  if (seconds > 0) output += `${seconds} s, `;
  if (millis > 0) output += `${millis} ms`;

  return output.trim().replace(/, $/, ''); // Remove trailing comma if any
}

