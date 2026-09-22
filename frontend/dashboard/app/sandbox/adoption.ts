import { DateTime } from "luxon";
import type { AppSpec } from "./scenario";
import type { AppBundle, ErrorGroup } from "./catalog";
import { matchesFilterExpr } from "./filter";
import { type Adoption, windowCoverage } from "./aggregate";
import type { SandboxRange } from "./query";

export type Release = { name: string; code: string; at: DateTime };

const UPTAKE_CAP = 0.93;
const UPTAKE_DAYS = 4.5;
const DAY_MS = 86_400_000;
const REFERENCE_WINDOW_DAYS = 30;

export function releasesOf(app: AppSpec, now: DateTime): Release[] {
  return app.versions.map((v) => ({
    name: v.name,
    code: v.code,
    at: now.minus({ days: v.releasedDaysAgo }),
  }));
}

// The share of sessions running a release or a newer one: users update over
// the days after a release, and a few never do.
function uptake(release: Release, t: number): number {
  const age = (t - release.at.toMillis()) / DAY_MS;
  return age <= 0 ? 0 : UPTAKE_CAP * (1 - Math.exp(-age / UPTAKE_DAYS));
}

function uptakeIntegral(release: Release, from: number, to: number): number {
  const released = release.at.toMillis();
  const start = Math.max(from, released);
  if (to <= start) {
    return 0;
  }
  const tau = UPTAKE_DAYS * DAY_MS;
  return (
    UPTAKE_CAP *
    (to -
      start -
      tau *
        (Math.exp(-(start - released) / tau) -
          Math.exp(-(to - released) / tau)))
  );
}

// Releases are newest first, so a version holds the users who took it and
// have not yet moved to the next one, and the oldest version keeps everyone
// who never updated.
export function shareAt(releases: Release[], index: number, at: DateTime) {
  const t = at.toMillis();
  const taken = index === releases.length - 1 ? 1 : uptake(releases[index], t);
  const moved = index === 0 ? 0 : uptake(releases[index - 1], t);
  return Math.max(0, taken - moved);
}

// The time-weighted share of one version over [from, to], in milliseconds.
function shareIntegral(
  releases: Release[],
  index: number,
  from: DateTime,
  to: DateTime,
): number {
  const a = from.toMillis();
  const b = to.toMillis();
  if (b <= a) {
    return 0;
  }
  const taken =
    index === releases.length - 1
      ? b - a
      : uptakeIntegral(releases[index], a, b);
  const moved = index === 0 ? 0 : uptakeIntegral(releases[index - 1], a, b);
  return Math.max(0, taken - moved);
}

export function adoptionOf(releases: Release[], names: string[]): Adoption {
  const indexes = releases.flatMap((r, i) =>
    names.includes(r.name) ? [i] : [],
  );
  return (from, to) =>
    indexes.reduce((sum, i) => sum + shareIntegral(releases, i, from, to), 0);
}

export function selectedVersions(
  app: AppSpec,
  filterExpr: string | null,
): { name: string; code: string }[] {
  return app.versions.filter((v) =>
    matchesFilterExpr(
      { version_name: v.name, version_code: v.code },
      filterExpr,
    ),
  );
}

export function selectedNames(app: AppSpec, filterExpr: string | null) {
  return selectedVersions(app, filterExpr).map((v) => v.name);
}

// The fraction of the 30-day reference window's sessions that ran the named
// versions inside the range.
export function versionCoverage(
  bundle: AppBundle,
  range: SandboxRange,
  names: string[],
): number {
  return windowCoverage(
    range,
    bundle.dataStart,
    adoptionOf(bundle.releases, names),
  );
}

export function sessionsIn(
  bundle: AppBundle,
  range: SandboxRange,
  names: string[],
): number {
  return (
    bundle.scenario.app.dailySessions *
    REFERENCE_WINDOW_DAYS *
    versionCoverage(bundle, range, names)
  );
}

export function referenceRange(): SandboxRange {
  const to = DateTime.utc();
  return {
    from: to.minus({ days: REFERENCE_WINDOW_DAYS }),
    to,
    group: "days",
    timezone: "UTC",
  };
}

// A group occurs on every version from the oldest to the newest its
// generated instances ran, so a bug introduced in the newest release shows
// up only there and a fixed one is absent from it. Its rate per session on a
// version grows with its instances there and with the version's age, and its
// events are that rate times the version's sessions, scaled so the last 30
// days add up to the group's count.
function groupRates(bundle: AppBundle, group: ErrorGroup): number[] {
  const versions = bundle.scenario.app.versions;
  const seen = versions.map(
    (v) =>
      group.instances.filter((inst) => inst.attribute.app_version === v.name)
        .length,
  );
  const first = seen.findIndex((n) => n > 0);
  const last = seen.length - 1 - [...seen].reverse().findIndex((n) => n > 0);
  return seen.map((n, i) =>
    first < 0 || i < first || i > last
      ? 0
      : Math.max(n, 0.75) * Math.pow(1.35, i),
  );
}

export function groupVersionCounts(
  bundle: AppBundle,
  group: ErrorGroup,
  range: SandboxRange,
  names: string[],
): { name: string; code: string; label: string; count: number }[] {
  const versions = bundle.scenario.app.versions;
  const rates = groupRates(bundle, group);
  const reference = referenceRange();
  const perReference = versions.reduce(
    (sum, v, i) =>
      sum + rates[i] * versionCoverage(bundle, reference, [v.name]),
    0,
  );
  if (perReference <= 0) {
    return [];
  }
  return versions.flatMap((v, i) => {
    if (rates[i] <= 0 || !names.includes(v.name)) {
      return [];
    }
    const expected =
      (group.count * rates[i] * versionCoverage(bundle, range, [v.name])) /
      perReference;
    return [
      {
        name: v.name,
        code: v.code,
        label: `${v.name} (${v.code})`,
        count: Math.round(expected),
      },
    ];
  });
}

export function groupCount(
  bundle: AppBundle,
  group: ErrorGroup,
  range: SandboxRange,
  names: string[],
): number {
  return groupVersionCounts(bundle, group, range, names).reduce(
    (sum, v) => sum + v.count,
    0,
  );
}
