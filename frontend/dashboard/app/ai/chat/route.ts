import { convertToModelMessages, hasToolCall, streamText, UIMessage } from 'ai';
import { DateTime } from 'luxon';
import { getPosthogServer } from "../../posthog-server";
import { reportAiUsage } from '../mcp/report_ai_usage';
import { getToolSchemas } from '../mcp/tools';

const posthog = getPosthogServer();
const apiOrigin = process?.env?.API_BASE_URL
const source = 'dashboard_ai_chat';

function truncateMessages(messages: UIMessage[], maxRecentMessages = 15): UIMessage[] {
    if (messages.length <= maxRecentMessages) {
        return messages;
    }

    // Always keep first message if it exists
    const firstMessage = messages[0];

    // Keep last N messages
    const recentMessages = messages.slice(-maxRecentMessages);

    // Identify messages with attachments in the middle section
    const middleMessages = messages.slice(1, -maxRecentMessages);
    const messagesWithAttachments = middleMessages.filter(msg =>
        msg.parts.some(part => part.type === 'file')
    );

    // Build final message array
    const truncatedMessages: UIMessage[] = [firstMessage];

    // Add messages with attachments from middle
    truncatedMessages.push(...messagesWithAttachments);

    // Add recent messages
    truncatedMessages.push(...recentMessages);

    return truncatedMessages;
}

function createApiHeaders(cookie: string | null | undefined): Record<string, string> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json"
    };

    if (cookie) {
        headers["cookie"] = cookie;
    }

    return headers;
}

export async function POST(req: Request) {
    let err = ""

    // Ensure AI is configured
    if (!process.env.AI_GATEWAY_API_KEY) {
        err = "Measure AI is not configured. Please set up Measure AI to use this feature. See https://github.com/measure-sh/measure/blob/main/docs/hosting/ai.md for more details."
        posthog.captureException(err, {
            source: source
        });
        return new Response(
            JSON.stringify({ error: err }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        )
    }

    let {
        teamId,
        appId,
        timezone,
        messages,
        model,
        selfHosted
    }: {
        teamId: string
        appId: string
        timezone: string
        messages: UIMessage[]
        model: string
        selfHosted: boolean
    } = await req.json()

    // Get user to identify user
    const userRes = await fetch(`${apiOrigin}/mcp/user`, {
        method: "GET",
        headers: createApiHeaders(req.headers.get("cookie")),
    })

    if (!userRes.ok) {
        return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            }
        )
    }

    const userData = await userRes.json()
    const userName = userData.user.name
    const userId = userData.user.id

    // Truncate messages to compress longer conversations
    const truncatedMessages = truncateMessages(messages, 15);

    // Build system prompt
    const systemPrompt = `
    You are **Measure AI**, a helpful and expert assistant for Android, iOS, Flutter, and React Native developers.
    You help debug and analyze mobile applications that use the **Measure SDK** for performance monitoring.

    ---

    ## 🧠 What You Can Do
    You are capable of:
    - Answering questions about mobile app development and Measure usage  
    - Using tools to fetch information about crashes, anrs, traces, bug reports, alerts and user journeys
    - Debugging Crashes, ANRs, Traces, and Bug Reports for apps that use Measure  

    If the user asks for something unrelated to these areas, politely tell them you cannot help with that.

    ---

    ## ⚙️ Current Context
    - **User:** ${userName}  
    - **Team ID:** ${teamId}  
    - **App ID:** ${appId ? appId : "No app_id provided"}  
    - **Timezone:** ${timezone}
    - **Current Time:** ${DateTime.now().setZone(timezone).toISO()}
    - **Self-Hosted:** ${selfHosted}

    Always assume that the app currently being analyzed has **app_id = "${appId}"**.  
    If app_id is missing or empty, clearly tell the user that app_id is required before running any query.

    ---

    ## 🗄️ Tools
    You have access to tools that let you fetch data from the user's Measure dashboard.

    When doing so:
    1. If app ID is missing or invalid, use getApps tool to get available apps for the team and pick the first app.
    2. Always use the correct team ID and app ID when calling other tools.
    3. If you have app ID, First use the getFilters tool to understand what filters are available.
    4. For tools that have required parameters, ensure you have all required parameters before calling the tool. Usually, you will need filters from getFilters tool to call other tools.
    5. If going for a wide search, apply all filters as described by the schema.
    6. Date range (from, to) must be provided, if user hasn't asked for a specific date range, use last 12 months as default.
    7. For filters that come in pairs (versions & version_codes, os_names & os_versions), if you provide one, you must provide the other and they must match in length
    8. Android os version numbers correspond to API levels (e.g., 33 = Android 13). When displaying them to user, show them as 'Android API Level XX' for clarity.
    9. Example of filters passed as params: http://localhost:3000/api/mcp/apps/19e26d60-2ad8-4ef7-8aab-333e1f5377fc/crashGroups?from=2024-10-09T10%3A11%3A47.866Z&to=2025-10-09T10%3A11%3A47.866Z&timezone=Asia%2FCalcutta&bug_report_statuses=0&limit=5&versions=0.11.0-SNAPSHOT,0.11.0-SNAPSHOT,0.10.0-SNAPSHOT,0.10.0-SNAPSHOT&version_codes=29137627,29099904,29045653,29043935&os_names=android,android,android&os_versions=36,33,27&countries=IN&network_providers=unknown&network_types=wifi&network_generations=unknown&locales=en-IN,en-US&device_manufacturers=Google,Xiaomi&device_names=emu64a,sunfish,tiare

    ---

    ## 🧱 Answer Formatting
    - Write clearly and conversationally.
    - Format code snippets using Markdown with language tags (e.g. \`\`\`kotlin\`\`\`, \`\`\`swift\`\`\`).
    - Never show raw database or API responses directly.
    - Summarize data in human-readable tables or bullet points when appropriate.

    ---
    End of system instructions.
    `;
    const result = streamText({
        model: model,
        messages: convertToModelMessages(truncatedMessages),
        system: systemPrompt,
        tools: getToolSchemas(source, userId, teamId, req.headers.get("cookie"), null),
        stopWhen: [hasToolCall("finalAnswer")],
    })

    const { inputTokens, outputTokens } = await result.totalUsage;
    await reportAiUsage(teamId, userId, source, model, inputTokens, outputTokens, req.headers.get("cookie"), null);

    const response = result.toUIMessageStreamResponse({
        sendSources: true,
        sendReasoning: true,
        originalMessages: messages
    })

    return response
}
