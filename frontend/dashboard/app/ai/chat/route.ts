import { formatDocSearchResults, searchDocs, TEXT_EMBEDDING_MODEL } from '@/app/utils/rag_utils';
import { convertToModelMessages, streamText, UIMessage } from 'ai';
import { DateTime } from 'luxon';
import { getPosthogServer } from "../../posthog-server";


const posthog = getPosthogServer();
const apiOrigin = process?.env?.API_BASE_URL
const AI_CHAT_AUTH_FAILURE_MSG = "Authentication and refresh failed"

async function checkAuth(request: Request) {
    const cookies = request.headers.get("cookie")
    const headers = new Headers(request.headers)
    headers.set("cookie", cookies || "")

    // Try to validate session
    let res = await fetch(`${apiOrigin}/auth/session`, {
        method: "GET",
        headers: headers,
    })

    let err = ""

    // If session is invalid, try to refresh
    if (!res.ok) {
        err = `AI Chat auth failure: get /auth/session returned ${res.status}, attempting refresh`
        posthog.captureException(err, {
            source: 'ai_chat_auth'
        });
        console.log(err)

        const refreshRes = await fetch(`${apiOrigin}/auth/refresh`, {
            method: "POST",
            headers: headers,
        })

        if (!refreshRes.ok) {
            err = `AI Chat refresh failure: post /auth/refresh returned ${refreshRes.status}`
            posthog.captureException(err, {
                source: 'ai_chat_auth'
            });
            console.log(err)
            return {
                authorized: false,
                error: AI_CHAT_AUTH_FAILURE_MSG,
                newCookies: null
            }
        }

        const refreshData = await refreshRes.json()
        if (refreshData.error) {
            err = `AI Chat refresh failure: post /auth/refresh returned ${refreshData.error}`
            posthog.captureException(err, {
                source: 'ai_chat_auth'
            });
            console.log(err)
            return {
                authorized: false,
                error: AI_CHAT_AUTH_FAILURE_MSG,
                newCookies: null
            }
        }

        // Get new cookies from refresh response
        const rawSetCookies: string[] = [];
        refreshRes.headers.forEach((value, name) => {
            if (name.toLowerCase() === 'set-cookie') {
                rawSetCookies.push(value);
            }
        });

        // Convert Set-Cookie headers into a single Cookie header string
        const cookieHeader = rawSetCookies
            .map(c => c.split(';')[0]) // take only "key=value" part
            .join('; ')

        // Retry session check with refreshed credentials
        const newHeaders = new Headers(headers)
        if (rawSetCookies.length > 0) {
            newHeaders.set("cookie", cookieHeader)
        }

        res = await fetch(`${apiOrigin}/auth/session`, {
            method: "GET",
            headers: newHeaders,
        })

        if (!res.ok) {
            err = `AI Chat auth failure after refresh: get /auth/session returned ${res.status}`
            posthog.captureException(err, {
                source: 'ai_chat_auth'
            });
            console.log(err)
            return {
                authorized: false,
                error: AI_CHAT_AUTH_FAILURE_MSG,
                newCookies: null
            }
        }

        const data = await res.json()
        if (data.error) {
            err = `AI Chat auth failure after refresh: get /auth/session returned ${data.error}`
            posthog.captureException(err, {
                source: 'ai_chat_auth'
            });
            console.log(err)
            return {
                authorized: false,
                error: AI_CHAT_AUTH_FAILURE_MSG,
                newCookies: null
            }
        }

        // Return success with new cookies to forward to client
        return {
            authorized: true,
            userName: data.user.name,
            newCookies: rawSetCookies, // Pass new cookies to be set in response
        }
    }

    // Original session was valid
    const data = await res.json()
    if (data.error) {
        err = `AI Chat auth failure: get /auth/session returned ${data.error}`
        posthog.captureException(err, {
            source: 'ai_chat_auth'
        });
        console.log(err)
        return {
            authorized: false,
            error: AI_CHAT_AUTH_FAILURE_MSG,
            newCookies: null
        }
    }

    return {
        authorized: true,
        userName: data.user.name,
        newCookies: null, // No refresh needed
    }
}

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

function extractLastUserQuery(messages: any[]): string {
    const lastUserMessage = messages
        .filter(m => m.role === 'user')
        .pop();

    if (!lastUserMessage) return '';

    return lastUserMessage.parts
        .filter((p: any) => p.type === 'text')
        .map((p: any) => p.text)
        .join(' ');
}

export async function POST(req: Request) {
    let err = ""

    // Ensure AI is configured
    if (!process.env.AI_GATEWAY_API_KEY) {
        err = "Measure AI is not configured. Please set up Measure AI to use this feature. See https://github.com/measure-sh/measure/blob/main/docs/hosting/ai.md for more details."
        posthog.captureException(err, {
            source: 'ai_chat_config'
        });
        console.log(err)
        return new Response(
            JSON.stringify({ error: err }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        )
    }

    // Check authentication with refresh fallback
    const authResult = await checkAuth(req)

    if (!authResult.authorized) {
        return new Response(
            JSON.stringify({ error: authResult.error || 'Unauthorized' }),
            {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            }
        )
    }

    const {
        teamId,
        messages,
        model,
        webSearch,
    }: {
        teamId: string,
        messages: UIMessage[]
        model: string
        webSearch: boolean
    } = await req.json()

    const { userName } = authResult

    const truncatedMessages = truncateMessages(messages, 15);

    // RAG: Search relevant documentation based on user's query
    let relevantDocs = '';
    try {
        const userQuery = extractLastUserQuery(truncatedMessages);

        if (userQuery) {
            console.log(`Searching docs for: "${userQuery.slice(0, 100)}..."`);

            const docSearchResult = await searchDocs(userQuery, 5); // Get top 5 relevant chunks
            relevantDocs = formatDocSearchResults(docSearchResult.results);

            reportAiUsage(teamId, TEXT_EMBEDDING_MODEL, docSearchResult.inputTokens, 0, authResult, req);

            console.log(`Found ${docSearchResult.results.length} relevant doc chunks. Used ${docSearchResult.inputTokens} tokens for embedding.`);
        }
    } catch (error) {
        // Continue without RAG if it fails
        console.error('RAG search error:', error);
    }

    // Build system prompt with relevant documentation
    const systemPrompt = `You are Measure AI. A helpful Android, iOS, Flutter and React Native expert developer assistant that can answer questions and help debug mobile applications. 

    You can answer questions about mobile app development or Measure usage and help debug crashes and issues in mobile apps that use Measure for app performance monitoring.

    If the user asks for something that is not related to using Measure, Crash debugging, ANR debugging or mobile app development, politely inform them that you can only help with Measure usage, Crash debugging, ANR debugging and mobile app development related questions.

    Never show raw database fields or raw API data. Always format your answers in a way that is easy for the user to understand.

    When providing code snippets, use markdown formatting with the appropriate language tag for syntax highlighting.

    Note: OS versions for android are stored as api levels. If os_version on an android app is 35, it means it is Android 15. When showing OS versions for Android, show API Level 35 (Android 15) to be clear.

    User Context:
    - User Name: ${userName}
    - Current Date & Time in ISO format: ${DateTime.now().toUTC().toISO()}

    ${relevantDocs ? `
    ## Relevant Measure Documentation

    The following documentation sections are most relevant to the user's question. Use this information to provide accurate, detailed answers.

    <measure_documentation>
    ${relevantDocs}
    </measure_documentation>

    When answering:
    1. Prioritize information from the documentation above
    2. Cite specific documentation files when referencing features. Always prefix them with base url: https://github.com/measure-sh/measure/blob/main/docs/ and show them as [filename](full-url-to-file)
    3. If the documentation doesn't fully cover the question, supplement with your general knowledge
    4. Always be clear about what's from official docs vs. general best practices
    5. If you cannot find an answer in the documentation, say "I don't know" or "The documentation does not cover this" rather than making something up.
    ` : ''}`;

    const result = streamText({
        model: webSearch ? 'perplexity/sonar' : model,
        providerOptions: { customOllama: { think: true, num_ctx: 131072 } },
        messages: convertToModelMessages(truncatedMessages),
        system: systemPrompt,
    })

    const { inputTokens, outputTokens } = await result.totalUsage;
    await reportAiUsage(teamId, model, inputTokens, outputTokens, authResult, req);

    const response = result.toUIMessageStreamResponse({
        sendSources: true,
        sendReasoning: true,
        originalMessages: messages
    })

    // If tokens were refreshed, forward new cookies to client
    if (authResult.newCookies) {
        const responseHeaders = new Headers(response.headers)

        if (authResult.newCookies?.length) {
            const responseHeaders = new Headers(response.headers)

            for (const cookie of authResult.newCookies) {
                responseHeaders.append("Set-Cookie", cookie)
            }

            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: responseHeaders,
            })
        }

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
        })
    }

    return response
}

async function reportAiUsage(teamId: string, model: string, inputTokens: number | undefined, outputTokens: number | undefined, authResult: { authorized: boolean; error: any; newCookies: null; userName?: undefined; } | { authorized: boolean; userName: any; newCookies: string[] | null; error?: undefined; }, req: Request) {
    let err = ""
    fetch(`${apiOrigin}/teams/${teamId}/usage/ai`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "cookie": authResult.newCookies?.map(c => c.split(';')[0]).join('; ') || req.headers.get("cookie") || "",
        },
        body: JSON.stringify({
            "team_id": teamId,
            "model": model,
            "input_tokens": inputTokens,
            "output_tokens": outputTokens
        }),
    }).then(res => {
        if (!res.ok) {
            err = `Failed to report AI usage: post /teams/${teamId}/usage/ai returned ${res.status}`
            posthog.captureException(err, {
                source: 'ai_chat_usage'
            });
            console.log(err);
        }
    }).catch(err => {
        err = `Error reporting AI usage: ${err}`
        posthog.captureException(err, {
            source: 'ai_chat_usage'
        });
        console.log(`Error reporting AI usage: ${err}`);
    });
}
