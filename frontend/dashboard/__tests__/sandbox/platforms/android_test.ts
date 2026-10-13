import { describe, expect, it } from "@jest/globals";
import { androidNativeScenario } from "@/app/sandbox/platforms/android";

const scenario = androidNativeScenario;
const jvmExceptions = scenario.exceptions.filter((e) => e.framework === "jvm");

describe("androidNativeScenario", () => {
  it("opens every stacktrace with the exception type and indents the frames", () => {
    for (const spec of jvmExceptions) {
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
    for (const spec of jvmExceptions) {
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

  it("reports each native crash as the frames the backend renders", () => {
    const native = scenario.exceptions.filter((e) => e.framework === "ndk");
    expect(native.map((e) => e.gwp_asan_report?.type)).toEqual([
      "use_after_free",
      "buffer_overflow",
    ]);
    for (const spec of native) {
      expect(spec.stacktrace).toMatch(/^#00 pc 0x[0-9a-f]{16} {2}/);
      expect(spec.cause).not.toMatch(/GWP-ASan/);
      expect(spec.stacktrace).not.toContain("Allocated by");
      expect(spec.stacktrace).not.toContain("Freed by");
    }
  });

  it("keeps the gwp-asan stacks out of the stacktrace, in their own report", () => {
    const [useAfterFree, bufferOverflow] = scenario.exceptions.filter(
      (e) => e.framework === "ndk",
    );
    expect(useAfterFree.gwp_asan_report?.deallocation?.thread_name).toBe(
      "main",
    );
    expect(useAfterFree.gwp_asan_report?.deallocation?.frames[2]).toContain(
      "acme::RowCache::evict(unsigned long)) (row_cache.cpp:54)",
    );
    expect(useAfterFree.gwp_asan_report?.allocation?.frames[4]).toContain(
      "acme::RowCache::acquire(int)) (row_cache.cpp:32)",
    );
    expect(bufferOverflow.gwp_asan_report?.deallocation).toBeUndefined();
    expect(bufferOverflow.gwp_asan_report?.allocation?.frames[4]).toContain(
      "(downscaler.cpp:52)",
    );
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
