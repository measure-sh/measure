import { describe, expect, it } from "@jest/globals";
import { iosNativeScenario } from "@/app/sandbox/platforms/ios";

describe("iosNativeScenario", () => {
  const scenario = iosNativeScenario;

  it("gives every screen a className with an iOS lifecycle", () => {
    for (const screen of scenario.screens) {
      expect(screen.className).toBeTruthy();
      expect(["view_controller", "swift_ui"]).toContain(screen.lifecycle);
    }
  });

  it("gives every device a dotted os_version rather than an Android API level", () => {
    for (const device of scenario.devices) {
      expect(device.os_version).toMatch(/^\d+\.\d+(\.\d+)?$/);
    }
  });

  it("names the handled NSError by its domain, with its code and userInfo and no stack", () => {
    const timeout = scenario.exceptions.find(
      (e) => e.key === "cart_request_timeout",
    )!;
    expect(timeout.severity).toBe("handled");
    expect(timeout.error).toEqual({
      code: "NSURLErrorDomain",
      num_code: -1001,
      meta: expect.objectContaining({
        NSLocalizedDescription: expect.any(String),
      }),
    });
    expect(timeout.type).toBe("NSURLErrorDomain");
    expect(timeout.exceptions).toEqual([]);
    expect(timeout.reportedOn).toBe("com.apple.NSURLSession-delegate");
  });

  const stacked = scenario.exceptions.filter((e) => e.exceptions.length > 0);

  it("describes every binary image with a uuid and an absolute path", () => {
    for (const exception of stacked) {
      expect(exception.binary_images?.length).toBeGreaterThan(0);
      for (const image of exception.binary_images ?? []) {
        expect(image.uuid).toMatch(/^[0-9a-f]{32}$/);
        expect(image.path.startsWith("/")).toBe(true);
      }
    }
  });

  it("marks only the app's own binary as in-app and symbolicates those frames to a file", () => {
    for (const exception of stacked) {
      for (const frame of exception.exceptions[0].frames) {
        expect(frame.in_app).toBe(frame.binary_name === "AcmeApp");
        if (frame.in_app) {
          expect(frame.file_name).toBeTruthy();
        }
      }
    }
  });

  it("truncates a long Swift symbol and repeats it in full underneath", () => {
    const withLongSymbol = scenario.exceptions.filter((e) =>
      e.stacktrace.includes("\n    Full symbol:"),
    );
    expect(withLongSymbol.length).toBeGreaterThan(0);
    for (const exception of withLongSymbol) {
      for (const line of exception.stacktrace.split("\n")) {
        if (line.startsWith("    Full symbol:")) {
          expect(line.length).toBeGreaterThan(55);
        }
      }
    }
  });
});
