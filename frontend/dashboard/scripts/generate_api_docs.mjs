/**
 * Generates the REST API reference pages under content/docs/api from the
 * OpenAPI specs in content/openapi/. One MDX page per operation, grouped
 * into a folder per tag, rendered by the OpenAPIPage component; the sidebar
 * shows each operation with its method badge. The output is gitignored;
 * this runs in the prebuild/dev/pretest chains so the pages always match
 * the specs.
 */

import fs from "node:fs";
import path from "node:path";
import { generateFiles } from "fumadocs-openapi";
import { createOpenAPI } from "fumadocs-openapi/server";
import { parse } from "yaml";

const sections = [
  {
    input: "./content/openapi/dashboard.yaml",
    output: "./content/docs/api/dashboard",
  },
  {
    input: "./content/openapi/sdk.yaml",
    output: "./content/docs/api/sdk",
  },
];

/**
 * Remove previously generated output so renamed or removed operations don't
 * leave stale pages behind. The section folder's own meta.json is committed
 * and kept; everything else in the folder is generated.
 */
function cleanOutput(dir) {
  if (!fs.existsSync(dir)) {
    return;
  }
  for (const entry of fs.readdirSync(dir)) {
    if (entry === "meta.json") {
      continue;
    }
    fs.rmSync(path.join(dir, entry), { recursive: true });
  }
}

/**
 * Folder slug for a tag name. Passed to generateFiles as its slugify and
 * reused by writeTagMeta, so the generated folders and the meta.json
 * targets can't disagree.
 */
function tagSlug(tag) {
  return tag.replace(/\s+/g, "-").toLowerCase();
}

/**
 * Tag folders are generated without meta.json, which would leave raw slugs
 * like "network-requests" as sidebar labels. Emit one per tag folder with
 * the spec's tag name as the title.
 */
function writeTagMeta(section) {
  const spec = parse(fs.readFileSync(section.input, "utf-8"));
  const tags = new Set();
  for (const pathItem of Object.values(spec.paths ?? {})) {
    for (const operation of Object.values(pathItem)) {
      for (const tag of operation?.tags ?? []) {
        tags.add(tag);
      }
    }
  }
  for (const tag of tags) {
    const dir = path.join(section.output, tagSlug(tag));
    if (!fs.existsSync(dir)) {
      console.warn(`No generated folder for tag "${tag}" at ${dir}`);
      continue;
    }
    fs.writeFileSync(
      path.join(dir, "meta.json"),
      JSON.stringify({ title: tag }, null, 2) + "\n",
    );
  }
}

for (const section of sections) {
  cleanOutput(section.output);
  await generateFiles({
    input: createOpenAPI({ input: [section.input] }),
    output: section.output,
    per: "operation",
    groupBy: "tag",
    slugify: tagSlug,
    includeDescription: true,
  });
  writeTagMeta(section);
  console.log(`Generated API pages: ${section.output}`);
}
