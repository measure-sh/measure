import type {
  ChatUIMessage,
  SearchTool,
} from "@/app/docs/components/ai/search";
import { secretFromEnvOrFile } from "@/app/utils/secret_key";
import { source } from "@/app/utils/docs_source";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  tool,
  toUIMessageStream,
} from "ai";
import { Document, type DocumentData } from "flexsearch";
import { z } from "zod";

// Docs AI chat, adapted from fumadocs' ai-sdk openrouter template; local
// additions are the /docs/chat path (because /api/* is reverse-proxied to
// the backend API by proxy.ts), the GET probe, and per-IP rate limiting.
// Enabled only when LLM_DOCS_CHAT_KEY (env or secret file) and
// LLM_MODEL both resolve; the client probes GET before showing
// the Ask AI trigger.

interface CustomDocument extends DocumentData {
  url: string;
  title: string;
  description: string;
  content: string;
}

let searchServer: Promise<Document<CustomDocument>> | undefined;

async function createSearchServer() {
  const search = new Document<CustomDocument>({
    document: {
      id: "url",
      index: ["title", "description", "content"],
      store: true,
    },
  });

  const docs = await chunkedAll(
    source.getPages().map(async (page) => {
      if (!("getText" in page.data)) return null;

      return {
        title: page.data.title,
        description: page.data.description,
        url: page.url,
        content: await page.data.getText("processed"),
      } as CustomDocument;
    }),
  );

  for (const doc of docs) {
    if (doc) search.add(doc);
  }

  return search;
}

async function chunkedAll<O>(promises: Promise<O>[]): Promise<O[]> {
  const SIZE = 50;
  const out: O[] = [];
  for (let i = 0; i < promises.length; i += SIZE) {
    out.push(...(await Promise.all(promises.slice(i, i + SIZE))));
  }
  return out;
}

// ── Per-IP rate limiting ────────────────────────────────────────────────
// In-memory sliding window; bounds LLM spend from a public
// endpoint. Resets on process restart.

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
const requestLog = new Map<string, number[]>();

function isRateLimited(request: Request): boolean {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const now = Date.now();
  const recent = (requestLog.get(ip) ?? []).filter(
    (at) => now - at < RATE_WINDOW_MS,
  );
  if (recent.length >= RATE_LIMIT) {
    requestLog.set(ip, recent);
    return true;
  }
  recent.push(now);
  requestLog.set(ip, recent);
  // keep the map from growing unboundedly
  if (requestLog.size > 10_000) {
    requestLog.clear();
  }
  return false;
}

const systemPrompt = [
  "You are an AI assistant for the measure.sh documentation site. Measure helps mobile teams monitor and fix crashes, ANRs, bugs, and performance issues.",
  "Use the `search` tool to retrieve relevant docs context before answering when needed.",
  "The `search` tool returns raw JSON results from documentation. Use those results to ground your answer and cite sources as markdown links using the document `url` field when available.",
  "If you cannot find the answer in search results, say you do not know and suggest a better search query.",
].join("\n");

const searchTool = tool({
  description: "Search the docs content and return raw JSON results.",
  inputSchema: z.object({
    query: z.string(),
    limit: z.number().int().min(1).max(100).default(10),
  }),
  async execute({ query, limit }) {
    const search = await (searchServer ??= createSearchServer());
    return await search.searchAsync(query, {
      limit,
      merge: true,
      enrich: true,
    });
  },
}) satisfies SearchTool;

// Read once per process, like the Go services read secrets at boot.
let apiKey: string | undefined;

function chatConfig(): { apiKey: string; model: string } | null {
  apiKey ??= secretFromEnvOrFile("LLM_DOCS_CHAT_KEY");
  const model = process.env.LLM_MODEL;
  if (!apiKey || !model) {
    return null;
  }
  return { apiKey, model };
}

/** Probe endpoint: 204 when the chat is configured, 404 otherwise. */
export async function GET() {
  if (!chatConfig()) {
    return new Response(null, { status: 404 });
  }
  return new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  const config = chatConfig();
  if (!config) {
    return new Response("AI chat is not configured.", { status: 503 });
  }
  if (isRateLimited(request)) {
    return new Response("Rate limit exceeded, try again in a minute.", {
      status: 429,
    });
  }

  const provider = createOpenRouter({ apiKey: config.apiKey });
  const reqJson = await request.json();

  const result = streamText({
    model: provider.chat(config.model),
    // ai v7 rejects system-role entries inside `messages`; the system
    // prompt goes through `instructions` instead.
    instructions: systemPrompt,
    stopWhen: stepCountIs(5),
    tools: {
      search: searchTool,
    },
    messages: await convertToModelMessages<ChatUIMessage>(
      reqJson.messages ?? [],
      {
        convertDataPart(part) {
          if (part.type === "data-client")
            return {
              type: "text",
              text: `[Client Context: ${JSON.stringify(part.data)}]`,
            };
        },
      },
    ),
    toolChoice: "auto",
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
