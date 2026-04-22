// formatBytesSI formats byte counts using decimal SI units (GB = 10^9).
// Used for billing/usage display so the rendered number matches how $/GB
// pricing is computed. For mobile-app binary sizes, use the binary-aware
// toKiloBytes / toMegaBytes helpers below.
export function formatBytesSI(bytes: number): string {
  const abs = Math.abs(bytes)
  if (abs >= 1000 ** 5) {
    return `${(bytes / 1000 ** 5).toFixed(2)} PB`
  }
  if (abs >= 1000 ** 4) {
    return `${(bytes / 1000 ** 4).toFixed(2)} TB`
  }
  if (abs >= 1000 ** 3) {
    return `${(bytes / 1000 ** 3).toFixed(2)} GB`
  }
  if (abs >= 1000 ** 2) {
    return `${(bytes / 1000 ** 2).toFixed(1)} MB`
  }
  if (abs >= 1000) {
    return `${(bytes / 1000).toFixed(1)} KB`
  }
  return `${bytes} B`
}

export function kilobytesToMegabytes(bytes: number): number {
  return bytes / 1024
}

export function toKiloBytes(bytes: number): number {
  return bytes / 1024
}

export function toMegaBytes(bytes: number): number {
  return bytes / 1024 / 1024
}

export function numberToKMB(value: number): string {
  const absValue = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (absValue >= 1_000_000_000) {
    const num = absValue / 1_000_000_000
    return sign + (Number.isInteger(num) ? `${num}B` : `${num.toString().replace(/\.0+$/, '')}B`)
  } else if (absValue >= 1_000_000) {
    const num = absValue / 1_000_000
    return sign + (Number.isInteger(num) ? `${num}M` : `${num.toString().replace(/\.0+$/, '')}M`)
  } else if (absValue >= 1000) {
    const num = absValue / 1000
    return sign + (Number.isInteger(num) ? `${num}K` : `${num.toString().replace(/\.0+$/, '')}K`)
  }
  return value.toString()
}
