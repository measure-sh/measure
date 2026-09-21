import { formatDeviceMemoryTier } from "@/app/utils/device_memory_tiers";
import { makeSessionsFilterKeysFixture } from "../msw/fixtures";

function backendTiers(): string[] {
  const keys = makeSessionsFilterKeysFixture().keys as {
    name: string;
    enum_values?: string[];
  }[];
  return keys.find((key) => key.name === "device_total_memory")!.enum_values!;
}

describe("formatDeviceMemoryTier", () => {
  it("labels every tier the backend can send", () => {
    for (const tier of backendTiers()) {
      expect(formatDeviceMemoryTier(tier)).not.toBe(tier);
    }
  });

  it("formats the bounded, open ended and unknown tiers", () => {
    expect(formatDeviceMemoryTier("9-12gb")).toBe("9–12 GB");
    expect(formatDeviceMemoryTier("33gb+")).toBe("33 GB+");
    expect(formatDeviceMemoryTier("unknown")).toBe("Unknown");
  });

  it("falls back to the raw value for an unrecognised tier", () => {
    expect(formatDeviceMemoryTier("99gb")).toBe("99gb");
  });
});
