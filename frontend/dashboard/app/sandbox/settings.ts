import { SANDBOX_TEAM_ID } from "../utils/sandbox";
import { catalog } from "./catalog";
import {
  isWithinRange,
  jsonResponse,
  paginate,
  parseRange,
  SandboxRoute,
  SandboxRouteContext,
} from "./query";
import { matchesFilterExpr } from "./filter";

export const SANDBOX_APP_ID = catalog().apps[0].id;

const SANDBOX_USER_ID = "00000000-0000-4000-8000-000000000001";

function daysAgoIso(days: number): string {
  return catalog().builtAt.minus({ days }).toISO()!;
}

function memberSinceDays(): number {
  const oldest = Math.max(
    ...Array.from(catalog().appById.values()).map(
      (bundle) => bundle.scenario.app.createdDaysAgo,
    ),
  );
  return oldest + 30;
}

function sandboxSessionUser() {
  const since = daysAgoIso(memberSinceDays());
  return {
    id: SANDBOX_USER_ID,
    own_team_id: SANDBOX_TEAM_ID,
    name: "Acme Developer",
    email: "developer@acme.shop",
    avatar_url: "",
    confirmed_at: since,
    last_sign_in_at: daysAgoIso(0),
    created_at: since,
    updated_at: daysAgoIso(1),
  };
}

function sandboxTeams() {
  return [catalog().team];
}

function sandboxApps() {
  return catalog().apps;
}

function sandboxAuthzAndMembers() {
  const user = sandboxSessionUser();
  return {
    can_invite_roles: ["viewer", "developer", "admin", "owner"],
    can_update_bug_reports: false,
    can_change_billing: false,
    can_create_app: false,
    can_rename_app: false,
    can_change_retention: false,
    can_rotate_api_key: false,
    can_write_sdk_config: false,
    can_rename_team: false,
    can_manage_slack: false,
    can_change_app_threshold_prefs: false,
    members: [
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: "viewer",
        last_sign_in_at: user.last_sign_in_at,
        created_at: user.created_at,
        authz: {
          current_user_assignable_roles_for_member: [],
          current_user_can_remove_member: false,
        },
      },
    ],
  };
}

export const teamRoutes: SandboxRoute[] = [
  {
    method: "GET",
    path: "/api/auth/session",
    handle: () => jsonResponse({ user: sandboxSessionUser() }),
  },
  {
    method: "GET",
    path: "/api/teams",
    handle: () => jsonResponse(sandboxTeams()),
  },
  {
    method: "GET",
    path: "/api/teams/:teamId/apps",
    handle: () => jsonResponse(sandboxApps()),
  },
  {
    method: "GET",
    path: "/api/teams/:teamId/authz",
    handle: () => jsonResponse(sandboxAuthzAndMembers()),
  },
];

function handleAlerts(ctx: SandboxRouteContext, appId: string): Response {
  const bundle = catalog().appById.get(appId);
  const range = parseRange(ctx.url);
  const inRange = (bundle?.alerts ?? []).filter((alert) =>
    isWithinRange(alert.created_at, range),
  );
  const { items, hasNext, hasPrev } = paginate(inRange, ctx.url);
  return jsonResponse({
    meta: { next: hasNext, previous: hasPrev },
    results: items,
  });
}

const SANDBOX_SDK_CONFIG = {
  trace_sampling_rate: 100,
  error_replay_duration: 30,
  error_fatal_take_screenshot: true,
  error_fatal_replay_enabled: true,
  error_unhandled_replay_enabled: true,
  error_handled_replay_enabled: false,
  error_fatal_sampling_rate: 100,
  error_unhandled_sampling_rate: 100,
  error_handled_sampling_rate: 10,
  anr_timeline_duration: 30,
  anr_take_screenshot: true,
  bug_report_timeline_duration: 30,
  launch_sampling_rate: 100,
  journey_sampling_rate: 100,
  http_sampling_rate: 100,
  http_disable_event_for_urls: [] as string[],
  http_track_request_for_urls: [] as string[],
  http_track_response_for_urls: [] as string[],
  http_blocked_headers: [] as string[],
  screenshot_mask_level: "all_text_and_media",
  profile_sampling_rate: 10,
  memory_usage_interval: 5,
  memory_usage_background_interval: 10,
  memory_usage_session_sampling_rate: 100,
  log_autocollect_enabled: true,
  log_min_severity: 12,
  log_ignore_patterns: [] as string[],
};

function sandboxThresholdPrefs(appId: string) {
  return {
    app_id: appId,
    error_good_threshold: 99.0,
    error_caution_threshold: 97.0,
    error_spike_min_count_threshold: 2,
    error_spike_min_rate_threshold: 2.0,
    created_at: daysAgoIso(30),
    updated_at: daysAgoIso(5),
  };
}

const SANDBOX_APP_RETENTION = { retention: 90 };

function handleBuilds(ctx: SandboxRouteContext, appId: string): Response {
  const bundle = catalog().appById.get(appId);
  const range = parseRange(ctx.url);
  const filterExpr = ctx.url.searchParams.get("filter_expr");
  const inRange = (bundle?.builds ?? [])
    .map((build) => {
      const files = build.files.filter(
        (file) =>
          isWithinRange(file.last_updated, range) &&
          matchesFilterExpr(
            {
              version_name: build.version_name,
              version_code: build.version_code,
              mapping_type: file.mapping_type,
            },
            filterExpr,
          ),
      );
      const last_updated = files.reduce(
        (latest, file) =>
          file.last_updated > latest ? file.last_updated : latest,
        "",
      );
      return { ...build, last_updated, files };
    })
    .filter((build) => build.files.length > 0);
  const { items, hasNext, hasPrev } = paginate(inRange, ctx.url);
  return jsonResponse({
    meta: { next: hasNext, previous: hasPrev },
    results: items,
  });
}

const SANDBOX_NOTIF_PREFS = {
  error_spike: true,
  app_hang_spike: true,
  bug_report: true,
  daily_summary: true,
};

function sandboxUsage(appId: string) {
  const bundle = catalog().appById.get(appId);
  return bundle ? [bundle.usage] : [];
}

function sandboxBillingInfo() {
  const bytesUsed = catalog()
    .apps.map((app) => catalog().appById.get(app.id)?.usage)
    .reduce(
      (sum, usage) =>
        sum + (usage?.monthly_app_usage.slice(-1)[0]?.bytes_in ?? 0),
      0,
    );
  const granted = Math.ceil((bytesUsed * 1.6) / 1_000_000_000_000);
  const periodStart = catalog().builtAt.startOf("month");
  return {
    team_id: SANDBOX_TEAM_ID,
    plan: "pro",
    bytes_granted: granted * 1_000_000_000_000,
    bytes_used: bytesUsed,
    bytes_unlimited: false,
    bytes_overage_allowed: true,
    status: "active",
    current_period_start: Math.floor(periodStart.toSeconds()),
    current_period_end: Math.floor(periodStart.plus({ months: 1 }).toSeconds()),
    canceled_at: 0,
    token_credits_used: 0,
    token_credits_granted: 0,
  };
}

function notAvailable(): Response {
  return jsonResponse({ error: "Not available in the interactive demo" }, 403);
}

export const settingsRoutes: SandboxRoute[] = [
  {
    method: "GET",
    path: "/api/apps/:appId/alerts",
    handle: (ctx) => handleAlerts(ctx, ctx.params.appId),
  },

  {
    method: "GET",
    path: "/api/apps/:appId/config",
    handle: () => jsonResponse(SANDBOX_SDK_CONFIG),
  },
  {
    method: "PATCH",
    path: "/api/apps/:appId/config",
    handle: notAvailable,
  },

  {
    method: "GET",
    path: "/api/apps/:appId/thresholdPrefs",
    handle: (ctx) => jsonResponse(sandboxThresholdPrefs(ctx.params.appId)),
  },
  {
    method: "PATCH",
    path: "/api/apps/:appId/thresholdPrefs",
    handle: notAvailable,
  },

  {
    method: "GET",
    path: "/api/apps/:appId/retention",
    handle: () => jsonResponse(SANDBOX_APP_RETENTION),
  },
  { method: "PATCH", path: "/api/apps/:appId/retention", handle: notAvailable },

  { method: "PATCH", path: "/api/apps/:appId/rename", handle: notAvailable },
  { method: "PATCH", path: "/api/apps/:appId/apiKey", handle: notAvailable },

  {
    method: "GET",
    path: "/api/apps/:appId/builds",
    handle: (ctx) => handleBuilds(ctx, ctx.params.appId),
  },
  {
    method: "GET",
    path: "/api/apps/:appId/builds/:fileId/download",
    handle: notAvailable,
  },

  {
    method: "GET",
    path: "/api/teams/:teamId/invites",
    handle: () => jsonResponse([]),
  },
  { method: "POST", path: "/api/teams/:teamId/invite", handle: notAvailable },
  {
    method: "PATCH",
    path: "/api/teams/:teamId/invite/:inviteId",
    handle: notAvailable,
  },
  {
    method: "DELETE",
    path: "/api/teams/:teamId/invite/:inviteId",
    handle: notAvailable,
  },
  {
    method: "DELETE",
    path: "/api/teams/:teamId/members/:memberId",
    handle: notAvailable,
  },
  {
    method: "PATCH",
    path: "/api/teams/:teamId/members/:memberId/role",
    handle: notAvailable,
  },
  { method: "PATCH", path: "/api/teams/:teamId/rename", handle: notAvailable },
  { method: "POST", path: "/api/auth/validateInvite", handle: notAvailable },

  {
    method: "GET",
    path: "/api/teams/:teamId/slack",
    handle: () =>
      jsonResponse({
        slack_team_name: "Acme Team",
        is_active: true,
        needs_reauth: false,
      }),
  },
  {
    method: "GET",
    path: "/api/teams/:teamId/slack/connect-url",
    handle: notAvailable,
  },
  {
    method: "PATCH",
    path: "/api/teams/:teamId/slack/status",
    handle: notAvailable,
  },
  { method: "DELETE", path: "/api/teams/:teamId/slack", handle: notAvailable },
  {
    method: "POST",
    path: "/api/teams/:teamId/slack/test",
    handle: notAvailable,
  },

  {
    method: "GET",
    path: "/api/prefs/notifPrefs",
    handle: () => jsonResponse(SANDBOX_NOTIF_PREFS),
  },
  {
    method: "PATCH",
    path: "/api/prefs/notifPrefs",
    handle: notAvailable,
  },

  {
    method: "GET",
    path: "/api/teams/:teamId/usage",
    handle: () =>
      jsonResponse(catalog().apps.flatMap((app) => sandboxUsage(app.id))),
  },
  {
    method: "GET",
    path: "/api/teams/:teamId/billing/info",
    handle: () => jsonResponse(sandboxBillingInfo()),
  },
  {
    method: "PATCH",
    path: "/api/teams/:teamId/billing/checkout",
    handle: notAvailable,
  },
  {
    method: "PATCH",
    path: "/api/teams/:teamId/billing/downgrade",
    handle: notAvailable,
  },
  {
    method: "PATCH",
    path: "/api/teams/:teamId/billing/undo-downgrade",
    handle: notAvailable,
  },
  {
    method: "POST",
    path: "/api/teams/:teamId/billing/portal",
    handle: notAvailable,
  },
];
