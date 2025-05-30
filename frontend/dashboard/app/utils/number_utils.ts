export function kilobytesToMegabytes(bytes: number): number {
  return bytes / 1024
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
