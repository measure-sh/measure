export async function validateMcpKey(mcpKey: string): Promise<{ userId: string, teamId: string } | null> {

    try {
        const res = await fetch(`${process.env.API_BASE_URL}/mcp/keys/teamId`, {
            headers: { Authorization: `Bearer ${mcpKey}` },
        });

        if (!res.ok) {
            console.error('MCP key validation failed status:', res.status);
            return null;
        }

        const data = await res.json();
        return { userId: data.user_id, teamId: data.team_id };
    } catch (err) {
        console.error('MCP key validation failed:', err);
        return null;
    }
}
