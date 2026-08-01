/**
 * Keeps the Open Graph and Twitter card tags in one place. Next merges a
 * page's metadata into the root layout's one field at a time, so a page
 * that writes its own openGraph and forgets twitter keeps the layout's
 * card and shares the home page title under its own URL. That shipped
 * once already.
 *
 * pageMetadata() in app/utils/metadata.ts builds both together, and the
 * unit tests next to this file cover it. This test is what makes that
 * coverage reach every page: no other file under app/ may write either
 * key, so a new page has to go through the helper.
 */
import { describe, expect, it } from "@jest/globals";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..", "..");
const APP_DIR = path.join(ROOT, "app");

// The one file allowed to write the tags, relative to the app directory.
const METADATA_HELPER = path.join("utils", "metadata.ts");

// An object key rather than the word anywhere, so referrer parsing that
// talks about "twitter" as a traffic source stays out of the results.
const SOCIAL_TAG_KEY = /^\s*(openGraph|twitter)\s*:/;

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...sourceFiles(fullPath));
    } else if (/\.tsx?$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function filesWritingSocialTags(): string[] {
  return sourceFiles(APP_DIR)
    .filter((file) => {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      return lines.some((line) => SOCIAL_TAG_KEY.test(line));
    })
    .map((file) => path.relative(APP_DIR, file))
    .sort();
}

describe("social tag ownership", () => {
  it("builds the openGraph and twitter tags only in the metadata helper", () => {
    expect(filesWritingSocialTags()).toEqual([METADATA_HELPER]);
  });
});
