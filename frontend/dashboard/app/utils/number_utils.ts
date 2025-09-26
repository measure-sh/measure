export function kilobytesToMegabytes(bytes: number): number {
  return bytes / 1024
}

export function numberToKMB(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 2
  }).format(value)
}
