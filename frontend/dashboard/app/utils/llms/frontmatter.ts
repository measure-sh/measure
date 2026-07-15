/**
 * Split a leading YAML frontmatter block (--- ... --- at the start of the
 * file) off markdown source.
 *
 * This module must stay dependency-free. It has two consumers: the llms
 * generator, which imports the compiled fumadocs content, and the
 * /page-md route handler, which a jest test imports directly. Jest cannot
 * load the compiled fumadocs content, so an import here that reaches it
 * would make the route handler's test fail to load. Parsing the yaml is
 * therefore the caller's business.
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
