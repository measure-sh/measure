import { describe, expect, it } from "@jest/globals";
import {
  flutterAndroidScenario,
  flutterIosScenario,
} from "@/app/sandbox/platforms/flutter";

describe.each([
  ["flutterAndroidScenario", flutterAndroidScenario],
  ["flutterIosScenario", flutterIosScenario],
])("%s", (_name, scenario) => {
  const dartExceptions = scenario.exceptions.filter(
    (e) => e.framework === "dart",
  );

  it("names every screen by a Dart route inside a native host", () => {
    for (const screen of scenario.screens) {
      expect(screen.routeName).toBeTruthy();
      expect(screen.className).toBeUndefined();
    }
    expect(scenario.host?.lifecycle).toBe(
      scenario.app.os === "android" ? "activity" : "view_controller",
    );
  });

  it("reports Dart exceptions with no other threads and no in-app frames", () => {
    expect(dartExceptions.length).toBeGreaterThan(0);
    for (const exception of dartExceptions) {
      expect(exception.threads).toEqual([]);
      for (const unit of exception.exceptions) {
        for (const frame of unit.frames) {
          expect(frame.in_app).toBe(false);
        }
      }
    }
  });

  it("renders Dart frames as numbered lines through the app package", () => {
    for (const exception of dartExceptions) {
      expect(exception.stacktrace).toContain("package:acme_app/");
      for (const line of exception.stacktrace.split("\n")) {
        expect(
          /^#\d\d {6}\S/.test(line) ||
            line === "===== asynchronous gap ===========================",
        ).toBe(true);
      }
    }
  });
});
