/**
 * Pins secretFromEnvOrFile's resolution order, mirrored from
 * backend/libs/secret: plain env var first, then <NAME>_FILE, empty
 * string when neither resolves.
 */
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import fs from "fs";

import { secretFromEnvOrFile } from "@/app/utils/secret_key";

const NAME = "TEST_SECRET_KEY";

afterEach(() => {
  delete process.env[NAME];
  delete process.env[`${NAME}_FILE`];
  jest.restoreAllMocks();
});

describe("secretFromEnvOrFile", () => {
  it("prefers the plain env var and trims it", () => {
    process.env[NAME] = "  from-env  ";
    process.env[`${NAME}_FILE`] = "/run/secrets/ignored";

    expect(secretFromEnvOrFile(NAME)).toBe("from-env");
  });

  it("falls back to the _FILE path and trims the contents", () => {
    process.env[`${NAME}_FILE`] = "/run/secrets/test-secret";
    jest.spyOn(fs, "readFileSync").mockReturnValue("from-file\n");

    expect(secretFromEnvOrFile(NAME)).toBe("from-file");
    expect(fs.readFileSync).toHaveBeenCalledWith(
      "/run/secrets/test-secret",
      "utf-8",
    );
  });

  it("treats an empty env var as unset", () => {
    process.env[NAME] = "   ";
    process.env[`${NAME}_FILE`] = "/run/secrets/test-secret";
    jest.spyOn(fs, "readFileSync").mockReturnValue("from-file");

    expect(secretFromEnvOrFile(NAME)).toBe("from-file");
  });

  it("returns empty when neither is set", () => {
    expect(secretFromEnvOrFile(NAME)).toBe("");
  });

  it("returns empty and warns when the file is unreadable", () => {
    process.env[`${NAME}_FILE`] = "/run/secrets/missing";
    jest.spyOn(fs, "readFileSync").mockImplementation(() => {
      throw new Error("ENOENT");
    });
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    expect(secretFromEnvOrFile(NAME)).toBe("");
    expect(warn).toHaveBeenCalled();
  });
});
