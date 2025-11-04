import { getPosthogServer } from "@/app/posthog-server";

export async function reportAiUsage(teamId: string, userId: string, source: string, model: string, inputTokens: number | undefined, outputTokens: number | undefined, cookies: string | null, mcpKey: string | null = null) {
    const apiOrigin = process?.env?.API_BASE_URL
    const posthog = getPosthogServer();
    let err = ""

    const headers: Record<string, string> = {
        "Content-Type": "application/json"
    };

    if (cookies) {
        headers["cookie"] = cookies;
    }

    if (mcpKey) {
        headers["Authorization"] = `Bearer ${mcpKey}`;
    }

    fetch(`${apiOrigin}/mcp/teams/${teamId}/usage/ai`, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
            "team_id": teamId,
            "user_id": userId,
            "source": source,
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