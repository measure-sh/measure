// Bot token scopes the Measure Slack app requests. This is the single source of
// truth: the OAuth authorize URL requests exactly these scopes, and an existing
// connection's granted scopes are compared against them to detect when a team
// connected before newer scopes were added and needs to reconnect.
export const REQUIRED_SLACK_SCOPES = [
  "app_mentions:read",
  "assistant:write",
  "chat:write",
  "chat:write.public",
  "channels:read",
  "groups:read",
  "channels:history",
  "groups:history",
  "im:history",
  "im:write",
  "commands",
  "files:write",
  "links:read",
  "links:write",
  "reactions:read",
  "reactions:write",
  "users:read",
  "users:read.email",
] as const;

// The comma-separated scope string for Slack's OAuth authorize URL.
export function slackScopeParam(): string {
  return REQUIRED_SLACK_SCOPES.join(",");
}

// A Slack connection stores the scopes it was granted at authorization time as a
// comma-separated string. It needs re-authorization when any currently required
// scope is missing, which happens when a team connected before newer scopes were
// added to the app. Slack does not prompt existing installs about new scopes, so
// we detect the gap here and surface a reconnect prompt.
export function slackConnectionNeedsReauth(
  grantedScopes: string | null | undefined,
): boolean {
  // When the granted scopes are unknown, for example an older API that does not
  // return the field yet, we cannot tell whether a reconnect is needed, so we do
  // not prompt. Only a known but incomplete scope list triggers the prompt.
  if (grantedScopes == null) {
    return false;
  }
  const granted = grantedScopes.split(",").map((scope) => scope.trim());
  return REQUIRED_SLACK_SCOPES.some((scope) => !granted.includes(scope));
}
