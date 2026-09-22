import type { MemoryAppImportance } from "../api/api_calls";

export const KB_PER_GB = 1024 * 1024;

export const HIGH_MEMORY_UTILIZATION_THRESHOLD = 0.75;

export const DEVICE_MEMORY_TIER_UNKNOWN = "unknown";

// Matches backend/libs/filter/sessions.go: the upper bound is exclusive and 0
// means unbounded.
const DEVICE_MEMORY_RANGES: {
  name: string;
  lowerKb: number;
  upperKb: number;
}[] = [
  { name: "0-4gb", lowerKb: 0, upperKb: 5 * KB_PER_GB },
  { name: "5-6gb", lowerKb: 5 * KB_PER_GB, upperKb: 7 * KB_PER_GB },
  { name: "7-8gb", lowerKb: 7 * KB_PER_GB, upperKb: 9 * KB_PER_GB },
  { name: "9-12gb", lowerKb: 9 * KB_PER_GB, upperKb: 13 * KB_PER_GB },
  { name: "13-16gb", lowerKb: 13 * KB_PER_GB, upperKb: 17 * KB_PER_GB },
  { name: "17-32gb", lowerKb: 17 * KB_PER_GB, upperKb: 33 * KB_PER_GB },
  { name: "33gb+", lowerKb: 33 * KB_PER_GB, upperKb: 0 },
];

export const DEVICE_MEMORY_TIERS = [
  ...DEVICE_MEMORY_RANGES.map((r) => r.name),
  DEVICE_MEMORY_TIER_UNKNOWN,
];

export function deviceMemoryTier(totalKb: number): string {
  if (!(totalKb > 0)) {
    return DEVICE_MEMORY_TIER_UNKNOWN;
  }
  for (const range of DEVICE_MEMORY_RANGES) {
    if (
      totalKb >= range.lowerKb &&
      (range.upperKb === 0 || totalKb < range.upperKb)
    ) {
      return range.name;
    }
  }
  return DEVICE_MEMORY_TIER_UNKNOWN;
}

const ANDROID_MEMORY_TARGETS_KB: Record<
  string,
  Record<MemoryAppImportance, number>
> = {
  "0-4gb": {
    foreground: 2 * KB_PER_GB,
    user_service: KB_PER_GB,
    background: KB_PER_GB,
  },
  "5-6gb": {
    foreground: (9 * KB_PER_GB) / 4,
    user_service: (5 * KB_PER_GB) / 4,
    background: (5 * KB_PER_GB) / 4,
  },
  "7-8gb": {
    foreground: (9 * KB_PER_GB) / 4,
    user_service: (3 * KB_PER_GB) / 2,
    background: (3 * KB_PER_GB) / 2,
  },
  "9-12gb": {
    foreground: (13 * KB_PER_GB) / 4,
    user_service: (7 * KB_PER_GB) / 4,
    background: (7 * KB_PER_GB) / 4,
  },
  "13-16gb": {
    foreground: (17 * KB_PER_GB) / 4,
    user_service: 2 * KB_PER_GB,
    background: 2 * KB_PER_GB,
  },
  "17-32gb": {
    foreground: 6 * KB_PER_GB,
    user_service: 4 * KB_PER_GB,
    background: 4 * KB_PER_GB,
  },
  "33gb+": {
    foreground: 10 * KB_PER_GB,
    user_service: 6 * KB_PER_GB,
    background: 6 * KB_PER_GB,
  },
};

export function androidMemoryTargetKb(
  deviceTotalMemoryKb: number,
  importance: MemoryAppImportance,
): number {
  const target =
    ANDROID_MEMORY_TARGETS_KB[deviceMemoryTier(deviceTotalMemoryKb)];
  return target ? target[importance] : 0;
}

const DEVICE_MEMORY_GB: Record<string, number> = {
  "Pixel 8 Pro": 12,
  "Pixel 9": 12,
  "Pixel Fold": 12,
  "Pixel 7": 8,
  "SM-S911B": 8,
  "SM-S901B": 8,
  "SM-G990B": 6,
  CPH2449: 16,
  "iPhone 15 Pro": 8,
  "iPhone 15": 6,
  "iPhone 14 Pro": 6,
  "iPhone 14": 6,
  "iPhone 13": 4,
  "iPhone SE (3rd generation)": 4,
  "iPad Air (5th generation)": 8,
};

// Android reports total memory a few percent under the shipping size, while
// Apple reports it as shipped; the tier bounds assume that difference.
export function deviceTotalMemoryKb(os: string, deviceModel: string): number {
  const nominalGb = DEVICE_MEMORY_GB[deviceModel] ?? (os === "ios" ? 6 : 8);
  const reported = os === "ios" ? nominalGb : nominalGb * 0.94;
  return Math.round(reported * KB_PER_GB);
}

// iOS ends a process well before it reaches physical memory; half of the
// device's memory stands in for that limit.
export function iosMemoryLimitKb(deviceTotalMemoryKb: number): number {
  return Math.round(deviceTotalMemoryKb / 2);
}
