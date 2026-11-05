import { formatSkipped } from "@/app/components/session_replay/stage_chrome";

describe("formatSkipped", () => {
  it.each([
    [12_000, "12s"],
    [59_600, "1m 0s"],
    [331_000, "5m 31s"],
    [600_000, "10m 0s"],
  ])("says %ims as %s", (ms, expected) => {
    expect(formatSkipped(ms)).toBe(expected);
  });
});
