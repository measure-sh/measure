import type { App } from "../../api/api_calls";

export function appPlatform(apps: App[], appId: string): string | undefined {
  return apps.find((app) => app.id === appId)?.os_names?.join(",");
}

export function funnelEventProps({
  teamId,
  appId,
  platform,
  entryPoint = "direct",
}: {
  teamId: string;
  appId: string;
  platform: string | undefined;
  entryPoint?: string;
}) {
  return {
    team_id: teamId,
    app_id: appId,
    app_platform: platform,
    feature_area: "funnels",
    entry_point: entryPoint,
  };
}

export type FrictionItemTarget = "error" | "trace" | "network" | "session";

// The chart reports the first step as 0, which selects the whole funnel, as
// null does.
export function stepProp(step: number | null): number | "overall" {
  return step !== null && step >= 1 ? step : "overall";
}
