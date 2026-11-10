export const mcpParamKeys = [
  "response_type",
  "client_id",
  "redirect_uri",
  "state",
  "code_challenge",
  "resource",
] as const;

export type McpParams = Record<(typeof mcpParamKeys)[number], string>;

export type RawParams = { get(key: string): string | null };

// pickMcpParams copies only the known MCP params from source, defaulting missing ones to "".
export function pickMcpParams(source: RawParams): McpParams {
  const params = {} as McpParams;
  for (const key of mcpParamKeys) {
    params[key] = source.get(key) ?? "";
  }
  return params;
}
