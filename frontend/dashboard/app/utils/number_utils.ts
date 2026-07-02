// formatBytesSI formats byte counts using decimal SI units (GB = 10^9).
// Used for billing/usage display so the rendered number matches how $/GB
// pricing is computed. For mobile-app binary sizes, use the binary-aware
// toKiloBytes / toMegaBytes helpers below.
export function formatBytesSI(bytes: number): string {
  const abs = Math.abs(bytes);
  if (abs >= 1000 ** 5) {
    return `${(bytes / 1000 ** 5).toFixed(2)} PB`;
  }
  if (abs >= 1000 ** 4) {
    return `${(bytes / 1000 ** 4).toFixed(2)} TB`;
  }
  if (abs >= 1000 ** 3) {
    return `${(bytes / 1000 ** 3).toFixed(2)} GB`;
  }
  if (abs >= 1000 ** 2) {
    return `${(bytes / 1000 ** 2).toFixed(1)} MB`;
  }
  if (abs >= 1000) {
    return `${(bytes / 1000).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

// formatBytesBinary formats a byte count using binary (1024-based) magnitudes
// with KB/MB/GB labels, showing one fractional digit below 100 and none above.
export function formatBytesBinary(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  if (Math.abs(bytes) < 1024) {
    return `${bytes} B`;
  }
  let value = bytes;
  let unit = 0;
  while (Math.abs(value) >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const fractionDigits = Math.abs(value) < 100 ? 1 : 0;
  return `${value.toFixed(fractionDigits)} ${units[unit]}`;
}

export function kilobytesToMegabytes(bytes: number): number {
  return bytes / 1024;
}

export function toKiloBytes(bytes: number): number {
  return bytes / 1024;
}

export function toMegaBytes(bytes: number): number {
  return bytes / 1024 / 1024;
}

export function numberToKMB(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  // Round to 2 decimals, then drop trailing zeros (and a dangling dot) so
  // exact values render cleanly: 6.69M, 1.5M, 1M (not 1.00M).
  const format = (num: number, suffix: string) =>
    sign + num.toFixed(2).replace(/\.?0+$/, "") + suffix;
  if (absValue >= 1_000_000_000) {
    return format(absValue / 1_000_000_000, "B");
  } else if (absValue >= 1_000_000) {
    return format(absValue / 1_000_000, "M");
  } else if (absValue >= 1000) {
    return format(absValue / 1000, "K");
  }
  return value.toString();
}
