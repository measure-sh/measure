import type { Profile } from "../api/api_calls";
import type { AppBundle } from "./catalog";
import { catalog } from "./catalog";
import { deviceAttributeBag, matchesFilterExpr } from "./filter";
import {
  isWithinRange,
  jsonResponse,
  paginate,
  parseRange,
  SandboxRoute,
  SandboxRouteContext,
} from "./query";

function profileAttributes(
  bundle: AppBundle,
  profile: Profile,
): Record<string, unknown> {
  const session = bundle.sessions.find(
    (s) => s.list.session_id === profile.session_id,
  );
  return {
    profile_trigger: profile.trigger,
    ...(session ? deviceAttributeBag(session.detail.attribute) : {}),
  };
}

function handleProfiles(ctx: SandboxRouteContext, appId: string): Response {
  const bundle = catalog().appById.get(appId);
  const range = parseRange(ctx.url);
  const filterExpr = ctx.url.searchParams.get("filter_expr");
  const matching = bundle
    ? bundle.profiles.filter(
        (profile) =>
          isWithinRange(profile.timestamp, range) &&
          matchesFilterExpr(profileAttributes(bundle, profile), filterExpr),
      )
    : [];
  const { items, hasNext, hasPrev } = paginate(matching, ctx.url);
  return jsonResponse({
    meta: { next: hasNext, previous: hasPrev },
    results: items,
  });
}

export const profilesRoutes: SandboxRoute[] = [
  {
    method: "GET",
    path: "/api/apps/:appId/profiles",
    handle: (ctx) => handleProfiles(ctx, ctx.params.appId),
  },
];
