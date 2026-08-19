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
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);

  let divisor: number;
  let suffix: string;
  if (abs >= 1_000_000_000) {
    divisor = 1_000_000_000;
    suffix = "B";
  } else if (abs >= 1_000_000) {
    divisor = 1_000_000;
    suffix = "M";
  } else if (abs >= 1000) {
    divisor = 1000;
    suffix = "K";
  } else {
    return value.toString();
  }

  let rounded = Math.round((abs / divisor) * 100) / 100;

  // Promote after rounding, e.g. 999.999K → 1M.
  if (rounded >= 1000) {
    if (suffix === "K") {
      rounded = rounded / 1000;
      suffix = "M";
    } else if (suffix === "M") {
      rounded = rounded / 1000;
      suffix = "B";
    }
  }

  // Round to 2 decimals, then drop trailing zeros (and a dangling dot) so
  // exact values render cleanly: 6.69M, 1.5M, 1M (not 1.00M).
  const text = rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");

  return sign + text + suffix;
}
