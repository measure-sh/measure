import { describe, expect, it } from "@jest/globals";
import {
  rnAndroidScenario,
  rnIosScenario,
} from "@/app/sandbox/platforms/react_native";

describe.each([
  ["rnAndroidScenario", rnAndroidScenario],
  ["rnIosScenario", rnIosScenario],
])("%s", (_name, scenario) => {
  const jsExceptions = scenario.exceptions.filter((e) => e.framework === "js");

  it("names every screen by its JS route inside a native host", () => {
    for (const screen of scenario.screens) {
      expect(screen.routeName).toBeTruthy();
      expect(screen.className).toBeUndefined();
    }
    expect(scenario.host?.lifecycle).toBe(
      scenario.app.os === "android" ? "activity" : "view_controller",
    );
  });

  it("reports JS exceptions with no other threads, symbolicated back to the sources", () => {
    expect(jsExceptions.length).toBeGreaterThan(0);
    for (const exception of jsExceptions) {
      expect(exception.threads).toEqual([]);
      for (const unit of exception.exceptions) {
        for (const frame of unit.frames) {
          expect(frame.in_app).toBe(true);
          expect(frame.file_name).toMatch(/^(src|node_modules)\//);
          expect(frame.col_num).toBeGreaterThan(0);
        }
      }
    }
  });

  it("writes every JS frame as Hermes prints it", () => {
    for (const exception of jsExceptions) {
      const [title, ...frames] = exception.stacktrace.split("\n");
      expect(title).toBe(`${exception.type}: ${exception.message}`);
      for (const line of frames) {
        expect(line).toMatch(/^ {4}at \S+ \(\S+:\d+:\d+\)$/);
      }
    }
  });

  it("pairs a fatal JS error with a native crash on the reporter's thread", () => {
    const paired = jsExceptions.filter((e) => e.nativeFollowUp);
    expect(paired.length).toBeGreaterThan(0);
    for (const spec of paired) {
      const followUp = scenario.exceptions.find(
        (e) => e.key === spec.nativeFollowUp,
      )!;
      expect(followUp.exceptions[0].thread_name).toBe(
        scenario.app.os === "android"
          ? "mqt_native_modules"
          : "com.facebook.react.ExceptionsManagerQueue",
      );
      if (scenario.app.os === "android") {
        expect(followUp.type).toBe(
          "com.facebook.react.common.JavascriptException",
        );
        expect(followUp.message).toContain(`${spec.type}: ${spec.message}`);
      } else {
        expect(followUp.exceptions[0].signal).toBe("SIGABRT");
        expect(followUp.exceptions[0].type).toBe("RCTFatalException");
      }
    }
  });
});
