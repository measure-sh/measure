'use client'

type SessionReplayEventVerticalConnectorProps = {
  milliseconds: number
}

export default function SessionReplayEventVerticalConnector({
  milliseconds
}: SessionReplayEventVerticalConnectorProps) {


  function getDividerHeightInPx() {
    return milliseconds * 3;
  }

  function formatTime() {
    const millisecondsPerSecond = 1000;
    const secondsPerMinute = 60;
    const minutesPerHour = 60;
    const hoursPerDay = 24;

    const days = Math.floor(milliseconds / (millisecondsPerSecond * secondsPerMinute * minutesPerHour * hoursPerDay));
    milliseconds %= millisecondsPerSecond * secondsPerMinute * minutesPerHour * hoursPerDay;

    const hours = Math.floor(milliseconds / (millisecondsPerSecond * secondsPerMinute * minutesPerHour));
    milliseconds %= millisecondsPerSecond * secondsPerMinute * minutesPerHour;

    const minutes = Math.floor(milliseconds / (millisecondsPerSecond * secondsPerMinute));
    milliseconds %= millisecondsPerSecond * secondsPerMinute;

    const seconds = Math.floor(milliseconds / millisecondsPerSecond);
    milliseconds %= millisecondsPerSecond;

    let output = '';
    if (days > 0) output += `${days} d, `;
    if (hours > 0) output += `${hours} h, `;
    if (minutes > 0) output += `${minutes} min, `;
    if (seconds > 0) output += `${seconds} s, `;
    if (milliseconds > 0) output += `${milliseconds} ms`;

    return output.trim().replace(/, $/, ''); // Remove trailing comma if any
  }

  return (
    <div className="flex flex-row w-full items-center justify-center">
      <div className={`bg-gray-200 w-0.5`} style={{ height: `${getDividerHeightInPx()}px` }} />
      <div className="px-2" />
      <p className="text-sm font-sans">{formatTime()}</p>
    </div>
  )
}