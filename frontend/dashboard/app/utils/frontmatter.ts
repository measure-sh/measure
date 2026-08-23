/**
 * This module must have no imports. A jest test imports it through the
 * /page-md route handler. The llms generators import the compiled
 * fumadocs content, which jest cannot load. An import that reaches that
 * content makes the test fail to load. For the same reason, the caller
 * parses the yaml.
 */
export function splitFrontmatter(text: string): {
  frontmatter: string | null;
  body: string;
} {
  const match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (!match) {
    return { frontmatter: null, body: text };
  }
  return { frontmatter: match[1], body: text.slice(match[0].length) };
}

/** The markdown source without its leading frontmatter block. */
export function stripFrontmatter(text: string): string {
  return splitFrontmatter(text).body;
}
