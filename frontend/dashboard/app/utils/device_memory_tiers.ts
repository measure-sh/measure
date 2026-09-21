const labels: Record<string, string> = {
  "0-4gb": "0–4 GB",
  "5-6gb": "5–6 GB",
  "7-8gb": "7–8 GB",
  "9-12gb": "9–12 GB",
  "13-16gb": "13–16 GB",
  "17-32gb": "17–32 GB",
  "33gb+": "33 GB+",
  unknown: "Unknown",
};

export function formatDeviceMemoryTier(tier: string) {
  return labels[tier] ?? tier;
}
