import { describe, expect, it } from "@jest/globals";
import { androidNativeScenario } from "@/app/sandbox/platforms/android";

const scenario = androidNativeScenario;

describe("androidNativeScenario", () => {
  it("opens every stacktrace with the exception type and indents the frames", () => {
    for (const spec of scenario.exceptions) {
      const [title, ...rest] = spec.stacktrace.split("\n");
      expect(title.startsWith(spec.exceptions[0].type)).toBe(true);
      for (const line of rest) {
        expect(line.startsWith("\tat ") || line.startsWith("Caused by: ")).toBe(
          true,
        );
      }
    }
  });

  it("names the app's own frames with the app package and a Kotlin file", () => {
    for (const spec of scenario.exceptions) {
      const appFrames = spec.exceptions
        .flatMap((unit) => unit.frames)
        .filter((frame) => frame.in_app);
      expect(appFrames.length).toBeGreaterThan(0);
      for (const frame of appFrames) {
        expect(frame.class_name).toMatch(/^com\.acme\.shop\./);
        expect(frame.file_name).toMatch(/\.kt$|^Unknown Source$/);
      }
    }
  });

  it("types the anr the way the android SDK reports it", () => {
    const anr = scenario.exceptions.find((e) => e.kind === "anr")!;
    expect(anr.type).toBe("sh.measure.android.anr.AnrError");
  });

  it("keeps the landing page's demo crash a NullPointerException on checkout", () => {
    const npe = scenario.exceptions.find(
      (e) => e.type === "java.lang.NullPointerException",
    )!;
    expect(npe.severity).toBe("fatal");
    expect(npe.file_name).toBe("CheckoutViewModel.kt");
  });
});
