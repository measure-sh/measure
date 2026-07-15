import fs from "fs";

/**
 * Resolve a sensitive config value the way backend/libs/secret does:
 *
 *  1. <NAME>      — plain env var (Measure Cloud injects secrets as env
 *     vars)
 *  2. <NAME>_FILE — path to a file holding the value (self-host Docker
 *     secrets, mounted at /run/secrets)
 *
 * Returns "" when neither is set or the file is unreadable; the caller
 * decides whether that is fatal. The compose file substitutes unset
 * variables with empty strings, so empty means unset throughout.
 */
export function secretFromEnvOrFile(name: string): string {
  const plain = process.env[name]?.trim();
  if (plain) {
    return plain;
  }
  const filePath = process.env[`${name}_FILE`];
  if (!filePath) {
    return "";
  }
  try {
    return fs.readFileSync(filePath, "utf-8").trim();
  } catch (error) {
    console.warn(`could not read ${name}_FILE: ${String(error)}`);
    return "";
  }
}
