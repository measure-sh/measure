import { selectErrorTrace } from "@/app/utils/error_utils";

describe("selectErrorTrace", () => {
  it("prefers the art thread dump over every other trace", () => {
    const result = selectErrorTrace({
      exception: { stacktrace: "exception trace" },
      anr: { stacktrace: "anr trace", art_thread_dump: "DALVIK THREADS (2):" },
    });

    expect(result).toEqual({
      trace: "DALVIK THREADS (2):",
      isThreadDump: true,
    });
  });

  it("falls back to the anr stacktrace when no dump arrived", () => {
    const result = selectErrorTrace({
      exception: null,
      anr: { stacktrace: "anr trace", art_thread_dump: "" },
    });

    expect(result).toEqual({ trace: "anr trace", isThreadDump: false });
  });

  it("uses the exception stacktrace for a crash", () => {
    const result = selectErrorTrace({
      exception: { stacktrace: "exception trace" },
      anr: null,
    });

    expect(result).toEqual({ trace: "exception trace", isThreadDump: false });
  });

  it("returns an empty trace when the event is missing", () => {
    expect(selectErrorTrace(undefined)).toEqual({
      trace: "",
      isThreadDump: false,
    });
  });
});
