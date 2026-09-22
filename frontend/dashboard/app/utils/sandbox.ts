export const SANDBOX_TEAM_ID = "sandbox";

export function isSandboxTeamId(teamId: string): boolean {
  return teamId === SANDBOX_TEAM_ID;
}

export function isSandboxPath(pathname: string): boolean {
  return pathname === "/sandbox" || pathname.startsWith("/sandbox/");
}
