import { buildExceptionPayload } from "../exception/exceptionBuilder";

describe("buildExceptionPayload", () => {
  it("builds payload for Error object", () => {
    const err = new Error("Something went wrong");
    err.stack = `Error: Something went wrong
    at myFunc (/src/index.js:12:34)`;

    const payload = buildExceptionPayload(err, true);

    expect(payload.exceptions).toBeDefined();
    expect(payload.exceptions.length).toBeGreaterThan(0);

    const exception = payload.exceptions[0];
    expect(payload.handled).toBe(true);
    expect(exception).toBeDefined();
    expect(exception?.message).toBe("Something went wrong");
    expect(exception?.frames && exception.frames[0]).toMatchObject({
      method_name: "myFunc",
      file_name: "/src/index.js",
      line_num: 12,
      col_num: 34,
      in_app: false,
    });
    expect(payload.framework).toBe("js");
  });

  it("handles non-Error inputs", () => {
    const payload = buildExceptionPayload("plain string error", false);

    expect(payload.exceptions).toBeDefined();
    expect(payload.exceptions.length).toBeGreaterThan(0);
    
    const exception = payload.exceptions[0];
    expect(payload.handled).toBe(false);
    expect(exception).toBeDefined();
    expect(exception!.type).toBe("string");
    expect(exception!.frames).toEqual([]);
  });
});