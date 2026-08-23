import { toStandaloneMarkdown } from "@/app/utils/llms/standalone_markdown";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://measure.sh";

/**
 * Docs and blog pages both satisfy this interface. Their sources declare
 * wider data types.
 */
export interface MarkdownSourcePage {
  url: string;
  data: {
    title: string;
    description?: string;
    getText: (type: "raw" | "processed") => Promise<string>;
    structuredData: { contents: { content: string }[] };
  };
}

/**
 * The result is one llms-full.txt section and also the response of the
 * /llms.docs and /llms.blog routes. This keeps the two outputs identical
 * for a given page.
 */
export async function renderPageMarkdown(
  page: MarkdownSourcePage,
): Promise<string> {
  const processed = await page.data.getText("processed");
  let text: string;
  try {
    text = toStandaloneMarkdown(processed, SITE_URL);
  } catch (error) {
    throw new Error(`Processed markdown of ${page.url} is not valid MDX`, {
      cause: error,
    });
  }

  // An API reference page renders through a JSX component, so its
  // processed markdown is empty. The operation summary is in the page's
  // structured search data. Serve that instead of only the title.
  if (!text) {
    text = page.data.structuredData.contents
      .map((item) => item.content)
      .join("\n\n");
  }

  const header = `# ${page.data.title}\n\n${page.data.description ?? ""}`;
  return `---\nSource: ${SITE_URL}${page.url}\n---\n\n${header}\n\n${text}`;
}
