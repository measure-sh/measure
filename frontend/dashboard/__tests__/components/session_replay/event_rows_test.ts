import {
  formatOffset,
  sessionEventTitle,
} from "@/app/components/session_replay/event_rows";

describe("formatOffset", () => {
  it.each([
    [0, "0:00.000"],
    [1234, "0:01.234"],
    [61_007, "1:01.007"],
  ])("formats %ims as %s", (ms, expected) => {
    expect(formatOffset(ms)).toBe(expected);
  });
});

describe("app hang titles", () => {
  it.each([
    [5090, "recovered", "Main thread blocked for 5.1s"],
    [2000, "recovered", "Main thread blocked for 2s"],
    [12_400, "recovered", "Main thread blocked for 12s"],
    [950, "recovered", "Main thread blocked for 1s"],
  ])("reads %ims as %s", (duration, state, expected) => {
    expect(sessionEventTitle("app_hang", { duration, state })).toBe(expected);
  });

  it("includes the killed state when the app did not recover", () => {
    expect(
      sessionEventTitle("app_hang", { duration: 8000, state: "killed" }),
    ).toBe("Main thread blocked for 8s, app killed");
  });

  it("formats messages without a duration", () => {
    expect(sessionEventTitle("app_hang", { state: "recovered" })).toBe(
      "Main thread blocked",
    );
    expect(sessionEventTitle("app_hang", { state: "killed" })).toBe(
      "Main thread blocked, app killed",
    );
  });

  it("returns a title when only a duration is given", () => {
    expect(sessionEventTitle("app_hang", { duration: 3000 })).not.toBe("");
  });
});
