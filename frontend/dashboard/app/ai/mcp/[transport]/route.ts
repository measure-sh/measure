import { createMcpHandler } from "mcp-handler";
import type { NextRequest } from "next/server";
import { getToolSchemas } from "../tools";
import { validateMcpKey } from "../validate_mcp_key";

const source = "mcp"
const handler = async (req: NextRequest) => {
    // Extract API key from Authorization header
    const authHeader = req.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response(
            JSON.stringify({ error: "Missing or invalid Authorization header" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
    }

    const mcpKey = authHeader.replace("Bearer ", "");

    // Validate API key
    const keyData = await validateMcpKey(mcpKey);
    if (!keyData || !keyData.userId || !keyData.teamId) {
        return new Response(
            JSON.stringify({ error: "Invalid API key" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
    }

    const { userId, teamId } = keyData;

    // Get tool schemas with authenticated headers
    const toolSchemas = getToolSchemas(source, userId, teamId, null, mcpKey);

    return createMcpHandler(
        (server) => {
            // Register tools
            Object.entries(toolSchemas).forEach(([name, tool]) => {
                server.tool(
                    name,
                    tool.description,
                    tool.inputSchema.shape as any,
                    async (args: any, _) => {
                        const result = await (tool.execute as any)(args);

                        // Wrap result in MCP content format
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: JSON.stringify(result, null, 2)
                                }
                            ]
                        };
                    }
                );
            });
        },
        {},
        {
            basePath: "/ai/mcp",
            maxDuration: 60,
            verboseLogs: true,
        }
    )(req);
};

export { handler as GET, handler as POST };
