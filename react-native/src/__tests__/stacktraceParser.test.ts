import { parseStacktrace } from "../exception/stacktraceParser";

describe("parseStacktrace", () => {
  it("parses a Chrome/V8 style stack trace", () => {
    const err = new Error("Something went wrong!");
    err.stack = `Error: Something went wrong!
    at myFunc (/path/to/file.js:10:15)
    at /path/to/other.js:20:5`;

    const parsed = parseStacktrace(err);

    expect(parsed.type).toBe("Error");
    expect(parsed.message).toBe("Something went wrong!");
    expect(parsed.stacktrace).toEqual([
      {
        function: "myFunc",
        file: "/path/to/file.js",
        line: 10,
        column: 15,
      },
      {
        function: "<anonymous>",
        file: "/path/to/other.js",
        line: 20,
        column: 5,
      },
    ]);
  });

  it("handles null/undefined errors gracefully", () => {
    expect(parseStacktrace(undefined)).toEqual({
      type: "UnknownError",
      message: "undefined",
      stacktrace: [],
    });
  });

  it("parses non-Error thrown values", () => {
    const parsed = parseStacktrace("oops");
    expect(parsed.type).toBe("string");
    expect(parsed.message).toBe("oops");
    expect(parsed.stacktrace).toEqual([]);
  });
});