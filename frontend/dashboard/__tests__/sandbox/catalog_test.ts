import { describe, expect, it } from "@jest/globals";
import { DateTime } from "luxon";
import { catalog, computeMetrics } from "@/app/sandbox/catalog";
import type { GeneratedEvent } from "@/app/sandbox/catalog";
import { decodeToken, orderTotals, parseState } from "@/app/sandbox/layouts";
import type { SpanSpec } from "@/app/sandbox/scenario";

function screenSequence(
  events: GeneratedEvent[],
): { name: string; timestamp: string; isFragment: boolean }[] {
  const seq: { name: string; timestamp: string; isFragment: boolean }[] = [];
  for (const event of events) {
    let name: string | null = null;
    let isFragment = false;
    if (
      (event.event_type === "lifecycle_activity" ||
        event.event_type === "lifecycle_fragment") &&
      event.type === "resumed"
    ) {
      name = String(event.class_name);
      isFragment = event.event_type === "lifecycle_fragment";
    } else if (
      event.event_type === "lifecycle_view_controller" &&
      event.type === "viewDidAppear"
    ) {
      name = String(event.class_name);
    } else if (
      event.event_type === "lifecycle_swift_ui" &&
      event.type === "on_appear"
    ) {
      name = String(event.class_name);
    } else if (event.event_type === "screen_view") {
      name = String(event.name);
    }
    if (name && seq[seq.length - 1]?.name !== name) {
      seq.push({ name, timestamp: String(event.timestamp), isFragment });
    }
  }
  return seq;
}

const world = catalog();
const apps = Array.from(world.appById.values());

describe.each(apps)("catalog: $app.name", (bundle) => {
  const {
    app,
    scenario,
    sessions,
    errorGroups,
    bugReports,
    traces,
    rootSpanNames,
    journey,
  } = bundle;
  const mainThread = scenario.threadNames.main;
  const allEvents = (session: (typeof sessions)[number]) =>
    Object.values(session.detail.threads).flat();

  it("resolves every session detail by id", () => {
    for (const session of sessions) {
      expect(session.detail.session_id).toBe(session.list.session_id);
      expect(session.detail.app_id).toBe(app.id);
    }
  });

  it("sorts every thread's events by timestamp", () => {
    for (const session of sessions) {
      for (const events of Object.values(session.detail.threads)) {
        for (let i = 1; i < events.length; i++) {
          expect(
            String(events[i].timestamp) >= String(events[i - 1].timestamp),
          ).toBe(true);
        }
      }
    }
  });

  it("carries an identical attribute block across every event's session", () => {
    for (const session of sessions) {
      expect(session.detail.attribute.os_name).toBe(scenario.app.os);
      expect(session.detail.attribute.app_unique_id).toBe(
        scenario.app.uniqueId,
      );
      expect(session.list.attribute.os_name).toBe(scenario.app.os);
    }
  });

  it("keeps the sessions list sorted newest first", () => {
    for (let i = 1; i < sessions.length; i++) {
      expect(
        sessions[i - 1].list.last_event_time >=
          sessions[i].list.last_event_time,
      ).toBe(true);
    }
  });

  it("keeps each user on one device, one US locale and one installation of their own", () => {
    const byUser = new Map<string, Set<string>>();
    const usersByInstallation = new Map<string, Set<string>>();
    for (const session of sessions) {
      const a = session.detail.attribute;
      expect(["en-US", "es-US", "en_US", "es_US"]).toContain(a.device_locale);
      const device = `${a.installation_id}|${a.device_model}|${a.device_locale}`;
      byUser.set(a.user_id, (byUser.get(a.user_id) ?? new Set()).add(device));
      usersByInstallation.set(
        a.installation_id,
        (usersByInstallation.get(a.installation_id) ?? new Set()).add(
          a.user_id,
        ),
      );
    }
    for (const devices of byUser.values()) {
      expect(devices.size).toBe(1);
    }
    for (const users of usersByInstallation.values()) {
      expect(users.size).toBe(1);
    }
  });

  it("launches from the first screen, recreates no screen on a hot launch, and ends every session that did not crash in the background", () => {
    for (const session of sessions) {
      const events = allEvents(session).sort((a, b) =>
        a.timestamp.localeCompare(b.timestamp),
      );
      const launch = events.find((e) => e.event_type.endsWith("_launch"))!;
      const firstScreen = events.find(
        (e) =>
          e.event_type === "lifecycle_activity" ||
          e.event_type === "lifecycle_view_controller",
      )!;
      expect(launch.launched_activity).toBe(firstScreen.class_name);
      if (launch.event_type === "hot_launch") {
        const beforeLaunch = events.filter(
          (e) => e.timestamp <= launch.timestamp,
        );
        expect(
          beforeLaunch.some(
            (e) => e.type === "created" || e.type === "viewDidLoad",
          ),
        ).toBe(false);
      }
      const crashed = events.some(
        (e) =>
          (e.event_type === "error" || e.event_type === "anr") &&
          e.severity === "fatal",
      );
      const last = events
        .filter((e) => e.event_type === "lifecycle_app")
        .pop()!;
      expect(last.type).toBe(crashed ? "foreground" : "background");
    }
  });

  it("moves memory smoothly from one sample to the next when nothing leaks", () => {
    for (const session of sessions) {
      const used = (session.detail.memory_usage ?? []).map((m) =>
        Number(m.rss),
      );
      const ios = (session.detail.memory_usage_absolute ?? []).map((m) =>
        Number(m.used_memory),
      );
      const samples = used.length > 0 ? used : ios;
      if (Math.max(...samples) > 600 * 1024) {
        continue;
      }
      for (let i = 1; i < samples.length; i++) {
        expect(Math.abs(samples[i] - samples[i - 1])).toBeLessThan(40 * 1024);
      }
    }
  });

  it("records an error on the thread it was thrown on", () => {
    for (const session of sessions) {
      for (const event of allEvents(session)) {
        if (event.event_type !== "error") {
          continue;
        }
        const spec = scenario.exceptions.find(
          (e) =>
            e.type === event.type &&
            e.message === event.message &&
            e.file_name === event.file_name,
        )!;
        const thrownOn = spec.exceptions[0]?.thread_name;
        if (spec.framework === "js") {
          expect(event.thread_name).not.toBe(mainThread);
        } else if (thrownOn && thrownOn !== "Thread 0 Crashed") {
          expect(event.thread_name).toBe(thrownOn);
        }
      }
    }
  });

  it("gives each platform its own screen events, memory samples and anr signal", () => {
    const eventTypes = new Set(
      sessions.flatMap((s) => allEvents(s).map((e) => e.event_type)),
    );
    if (scenario.app.framework === "native") {
      expect(
        eventTypes.has("lifecycle_activity") ||
          eventTypes.has("lifecycle_view_controller"),
      ).toBe(true);
    } else {
      expect(eventTypes.has("screen_view")).toBe(true);
    }
    if (scenario.app.os === "android") {
      expect(eventTypes.has("anr")).toBe(true);
    } else {
      expect(eventTypes.has("anr")).toBe(false);
    }
    for (const session of sessions) {
      if (scenario.app.os === "android") {
        expect(session.detail.memory_usage).not.toBeNull();
        expect(session.detail.memory_usage_absolute).toBeNull();
      } else {
        expect(session.detail.memory_usage).toBeNull();
        expect(session.detail.memory_usage_absolute).not.toBeNull();
      }
    }
  });

  it("matches exception.framework to the app's framework, and an anr to the native android host", () => {
    const nativeFramework = scenario.app.os === "android" ? "jvm" : "apple";
    const expected =
      scenario.app.framework === "native"
        ? nativeFramework
        : scenario.app.framework === "flutter"
          ? "dart"
          : "js";
    for (const spec of scenario.exceptions) {
      if (spec.kind === "anr") {
        expect(spec.framework).toBe("jvm");
        expect(scenario.app.os).toBe("android");
      } else {
        expect([expected, nativeFramework]).toContain(spec.framework);
      }
    }
  });

  it("renders every error group with a deep stacktrace in its platform's format", () => {
    for (const group of errorGroups) {
      const spec = scenario.exceptions.find(
        (e) =>
          e.type === group.type &&
          e.message === group.message &&
          e.file_name === group.file_name,
      )!;
      const stacktrace =
        group.instances[0].exception?.stacktrace ??
        group.instances[0].anr!.stacktrace;
      expect(stacktrace).toBe(spec.stacktrace);
      if (spec.exceptions.length === 0) {
        expect(spec.framework).toBe("apple");
        expect(group.type).toBe(spec.error!.code);
        continue;
      }
      const lines = stacktrace.split("\n").filter((line) => line !== "");
      expect(lines.length).toBeGreaterThanOrEqual(12);
      const chained = spec.exceptions.length > 1;
      switch (spec.framework) {
        case "jvm":
          expect(lines[0].startsWith(spec.exceptions[0].type)).toBe(true);
          expect(lines.some((line) => /^\tat \S/.test(line))).toBe(true);
          expect(lines.some((line) => line.startsWith("Caused by: "))).toBe(
            chained,
          );
          break;
        case "dart":
          expect(lines[0]).toMatch(/^#00 {6}\S/);
          expect(
            lines.some((line) => line.startsWith("===== asynchronous gap")),
          ).toBe(chained);
          break;
        case "js":
          expect(lines[1]).toMatch(/^ {4}at \S/);
          break;
        case "apple":
          expect(lines[0].endsWith(":")).toBe(true);
          expect(lines[1]).toMatch(/^ {2}0 {3}\S/);
          break;
      }
    }
  });

  it("renders each instance's other threads the way the backend serializes frames", () => {
    for (const group of errorGroups) {
      const spec = scenario.exceptions.find(
        (e) =>
          e.type === group.type &&
          e.message === group.message &&
          e.file_name === group.file_name,
      )!;
      for (const instance of group.instances) {
        expect(instance.threads.map((t) => t.name)).toEqual(
          spec.threads.map((t) => t.name),
        );
        for (const thread of instance.threads) {
          expect(thread.frames.length).toBeGreaterThan(0);
          for (const frame of thread.frames) {
            if (spec.framework === "apple") {
              expect(frame).toMatch(/^\s*\d+ {3}\S+\s+0x[0-9a-f]{16} {3}\S/);
            } else {
              expect(frame).toMatch(/^[\w$.<>]+(\(.*\))?$/);
            }
          }
        }
      }
    }
  });

  it("reports a crash with a native follow-up twice in the same session, milliseconds apart", () => {
    const paired = scenario.exceptions.filter((e) => e.nativeFollowUp);
    if (paired.length === 0) {
      return;
    }
    for (const spec of paired) {
      const followUp = scenario.exceptions.find(
        (e) => e.key === spec.nativeFollowUp,
      )!;
      const jsGroup = errorGroups.find((g) => g.type === spec.type)!;
      const nativeGroup = errorGroups.find((g) => g.type === followUp.type)!;
      expect(jsGroup.instances.map((i) => i.session_id)).toEqual(
        nativeGroup.instances.map((i) => i.session_id),
      );

      // The native report misses the few crashes where the process dies before
      // the SDK can flush it.
      const ratio = nativeGroup.count / jsGroup.count;
      expect(ratio).toBeGreaterThanOrEqual(0.92);
      expect(ratio).toBeLessThan(1);

      for (let i = 0; i < jsGroup.instances.length; i++) {
        const first = DateTime.fromISO(jsGroup.instances[i].timestamp);
        const second = DateTime.fromISO(nativeGroup.instances[i].timestamp);
        const gap = second.diff(first).as("milliseconds");
        expect(gap).toBeGreaterThanOrEqual(20);
        expect(gap).toBeLessThanOrEqual(80);
      }

      const session = sessions.find(
        (s) => s.list.session_id === nativeGroup.instances[0].session_id,
      )!;
      const crashingThread = followUp.exceptions[0].thread_name!;
      const nativeEvents = (
        session.detail.threads[crashingThread] ?? []
      ).filter((e) => e.event_type === "error");
      expect(nativeEvents).toHaveLength(1);
      expect(nativeEvents[0].stacktrace).toBe(followUp.stacktrace);

      if (scenario.app.os === "android") {
        const exit = allEvents(session).find(
          (e) => e.event_type === "app_exit",
        )!;
        expect(exit.trace).toBe(followUp.stacktrace);
      }
    }
  });

  it("links every error event, group instance and error group to each other", () => {
    const groupIds = new Set(errorGroups.map((g) => g.id));
    const sessionIds = new Set(sessions.map((s) => s.list.session_id));
    for (const session of sessions) {
      for (const event of allEvents(session)) {
        if (event.event_type === "error" || event.event_type === "anr") {
          expect(groupIds.has(String(event.group_id))).toBe(true);
        }
      }
    }
    for (const group of errorGroups) {
      for (const instance of group.instances) {
        expect(sessionIds.has(instance.session_id)).toBe(true);
      }
    }
  });

  it("sums crash-type group counts to the app's 30-day crash total", () => {
    const crashGroups = errorGroups.filter(
      (g) => g.error_type === "exception" && g.severity === "fatal",
    );
    expect(crashGroups.length).toBeGreaterThan(0);
    const expectedTotal = Math.round(
      scenario.app.dailySessions * 30 * (1 - scenario.app.crashFreeRate),
    );
    const total = crashGroups.reduce((sum, g) => sum + g.count, 0);
    expect(total).toBe(expectedTotal);
    for (const group of crashGroups) {
      expect(group.count).toBeGreaterThan(0);
    }
  });

  it("resolves every session trace_id to a trace that points back to the session", () => {
    for (const session of sessions) {
      for (const ref of session.detail.traces) {
        const trace = traces.get(ref.trace_id);
        expect(trace).toBeDefined();
        expect(trace?.session_id).toBe(session.list.session_id);
      }
    }
  });

  it("serves every root span name via rootSpanNames", () => {
    for (const trace of traces.values()) {
      const root = trace.spans.find((s) => s.parent_id === "");
      expect(root).toBeDefined();
      expect(rootSpanNames).toContain(root!.span_name);
    }
  });

  it("resolves every session bug_report_id to a bug report with a triage status", () => {
    const byEventId = new Map(bugReports.map((r) => [r.event_id, r]));
    for (const session of sessions) {
      for (const event of allEvents(session)) {
        if (event.event_type === "bug_report") {
          const report = byEventId.get(String(event.bug_report_id));
          expect(report).toBeDefined();
          expect(report?.session_id).toBe(session.list.session_id);
        }
      }
    }
    for (const report of bugReports) {
      expect([0, 1]).toContain(report.status);
    }
  });

  it("raises alerts only for fatal crash and ANR groups and bug reports, each with a url that resolves", () => {
    for (const alert of bundle.alerts) {
      expect(["crash_spike", "anr_spike", "bug_report"]).toContain(alert.type);
      if (alert.type === "bug_report") {
        const report = bugReports.find((r) => r.event_id === alert.entity_id);
        expect(report).toBeDefined();
        expect(alert.url).toBe(
          `/${world.team.id}/bug_reports/${app.id}/${alert.entity_id}`,
        );
        expect(alert.message).toBe(report!.description);
        continue;
      }
      const match = alert.url.match(/\/errors\/[^/]+\/([^/]+)\/([^/]+)$/);
      expect(match).not.toBeNull();
      const [, groupId, encodedName] = match!;
      const group = errorGroups.find((g) => g.id === groupId);
      expect(group).toBeDefined();
      expect(group!.id).toBe(alert.entity_id);
      expect(decodeURIComponent(encodedName)).toBe(
        group!.type + (group!.file_name ? `@${group!.file_name}` : ""),
      );
      expect(group!.severity).toBe("fatal");
      expect(alert.type).toBe(
        group!.error_type === "anr" ? "anr_spike" : "crash_spike",
      );
      const method = group!.method_name.endsWith(")")
        ? group!.method_name
        : `${group!.method_name}()`;
      expect(alert.message).toBe(
        `${group!.file_name}: ${method} - ${group!.message || group!.type}`,
      );
      const firstInstance = [...group!.instances]
        .map((i) => i.timestamp)
        .sort()[0];
      expect(alert.created_at >= firstInstance).toBe(true);
    }
  });

  it("gives every journey node id a screen name present in the app's sessions", () => {
    expect(journey.nodes.length).toBeGreaterThan(0);
    expect(journey.links.length).toBeGreaterThan(0);
    for (const node of journey.nodes) {
      const seenSomewhere = sessions.some((s) =>
        allEvents(s).some(
          (e) =>
            (e.event_type === "lifecycle_activity" &&
              e.class_name === node.id) ||
            (e.event_type === "lifecycle_fragment" &&
              e.class_name === node.id) ||
            (e.event_type === "lifecycle_view_controller" &&
              e.type === "viewDidAppear" &&
              e.class_name === node.id) ||
            (e.event_type === "lifecycle_swift_ui" &&
              e.type === "on_appear" &&
              e.class_name === node.id) ||
            (e.event_type === "screen_view" && e.name === node.id),
        ),
      );
      expect(seenSomewhere).toBe(true);
    }
  });

  it("never lets a screen pass on more traffic than reached it", () => {
    const monthlySessions = scenario.app.dailySessions * 30;
    const sequences = sessions.map((s) =>
      screenSequence(s.detail.threads[mainThread] ?? []).map((e) => e.name),
    );
    const entered = new Map<string, number>();
    for (const sequence of sequences) {
      const first = sequence[0];
      if (first !== undefined) {
        entered.set(first, (entered.get(first) ?? 0) + 1);
      }
    }
    const entryTotal = Array.from(entered.values()).reduce((a, b) => a + b, 0);
    const inflow = new Map<string, number>();
    for (const [name, count] of entered) {
      inflow.set(name, Math.round((count / entryTotal) * monthlySessions));
    }
    for (const link of journey.links) {
      expect(link.value).toBeGreaterThanOrEqual(0);
      inflow.set(link.target, (inflow.get(link.target) ?? 0) + link.value);
    }
    const outflow = new Map<string, number>();
    for (const link of journey.links) {
      outflow.set(link.source, (outflow.get(link.source) ?? 0) + link.value);
    }
    for (const [node, out] of outflow) {
      // The slack covers rounding between the entry counts estimated here and the
      // ones the journey was split from.
      expect(out).toBeLessThanOrEqual((inflow.get(node) ?? 0) * 0.98 + 2);
    }
    const monthlyEntries = Array.from(entered.keys()).reduce(
      (sum, name) =>
        sum +
        Math.round(((entered.get(name) ?? 0) / entryTotal) * monthlySessions),
      0,
    );
    expect(Math.abs(monthlyEntries - monthlySessions)).toBeLessThanOrEqual(2);
  });

  it("counts only fatal crash and ANR groups as journey issues", () => {
    const listed = new Set(
      journey.nodes.flatMap((node) => [
        ...node.issues.crashes.map((i) => i.id),
        ...node.issues.anrs.map((i) => i.id),
      ]),
    );
    for (const group of errorGroups) {
      if (group.severity !== "fatal") {
        expect(listed.has(group.id)).toBe(false);
      }
    }
    for (const node of journey.nodes) {
      for (const issue of node.issues.crashes) {
        const group = errorGroups.find((g) => g.id === issue.id)!;
        expect(group.error_type).toBe("exception");
        expect(group.severity).toBe("fatal");
        expect(group.screen).toBe(node.id);
        expect(issue.count).toBe(group.count);
      }
      for (const issue of node.issues.anrs) {
        const group = errorGroups.find((g) => g.id === issue.id)!;
        expect(group.error_type).toBe("anr");
        expect(issue.count).toBe(group.count);
      }
    }
    const fatalTotal = errorGroups
      .filter((g) => g.severity === "fatal")
      .reduce((sum, g) => sum + g.count, 0);
    expect(journey.totalIssues).toBe(fatalTotal);
  });

  it("spreads journey traffic across screens rather than through one shell", () => {
    const appearances = new Map<string, number>();
    for (const link of journey.links) {
      for (const node of [link.source, link.target]) {
        appearances.set(node, (appearances.get(node) ?? 0) + 1);
      }
    }
    // A host activity mistaken for a screen would be an end of nearly every link.
    for (const count of appearances.values()) {
      expect(count).toBeLessThan(journey.links.length * 0.6);
    }
  });

  it("dates every build before the first session on its version and after the app was created, newest version first", () => {
    for (const build of bundle.builds) {
      const versionSessions = sessions.filter(
        (s) => s.list.attribute.app_version === build.version_name,
      );
      for (const session of versionSessions) {
        expect(build.last_updated < session.list.first_event_time).toBe(true);
      }
      for (const file of build.files) {
        expect(file.last_updated).toBe(build.last_updated);
      }
      expect(build.files.map((f) => f.mapping_type)).toEqual(
        scenario.app.mappingTypes,
      );
    }
    expect(bundle.builds.map((b) => b.version_name)).toEqual([
      scenario.app.candidate.name,
      ...scenario.app.versions.map((v) => v.name),
    ]);
    for (let i = 1; i < bundle.builds.length; i++) {
      expect(
        bundle.builds[i].last_updated < bundle.builds[i - 1].last_updated,
      ).toBe(true);
    }
    const createdAt = world.builtAt
      .minus({ days: scenario.app.createdDaysAgo })
      .toISO()!;
    for (const build of bundle.builds) {
      expect(build.last_updated > createdAt).toBe(true);
    }
  });

  it("runs every session from its first event to its last, for seconds to minutes", () => {
    for (const session of sessions) {
      const stamps = [
        ...allEvents(session).map((event) => String(event.timestamp)),
        ...session.detail.traces.map((trace) => trace.end_time),
      ].map((iso) => DateTime.fromISO(iso).toMillis());
      const last = Math.max(...stamps);
      expect(DateTime.fromISO(session.list.last_event_time).toMillis()).toBe(
        last,
      );
      expect(session.detail.duration).toBe(
        last - DateTime.fromISO(session.list.first_event_time).toMillis(),
      );
      expect(Number(session.list.duration)).toBe(session.detail.duration);
      expect(session.detail.duration).toBeGreaterThanOrEqual(2_000);
      expect(session.detail.duration).toBeLessThanOrEqual(4 * 60_000);
      const samples =
        session.detail.memory_usage?.length ??
        session.detail.memory_usage_absolute?.length ??
        0;
      expect(samples).toBeGreaterThan(0);
      expect(session.detail.cpu_usage.length).toBe(samples);
    }
  });

  it("nests every span inside its parent across more than one thread, with durations equal to end minus start", () => {
    for (const trace of traces.values()) {
      const byId = new Map(trace.spans.map((s) => [s.span_id, s]));
      const root = trace.spans.find((s) => s.parent_id === "")!;
      expect(trace.spans.some((s) => s.thread_name !== root.thread_name)).toBe(
        true,
      );
      expect(trace.duration).toBe(
        DateTime.fromISO(trace.end_time)
          .diff(DateTime.fromISO(trace.start_time))
          .as("milliseconds"),
      );
      for (const span of trace.spans) {
        expect(span.duration).toBe(
          DateTime.fromISO(span.end_time)
            .diff(DateTime.fromISO(span.start_time))
            .as("milliseconds"),
        );
        for (const checkpoint of span.checkpoints ?? []) {
          expect(checkpoint.timestamp >= span.start_time).toBe(true);
          expect(checkpoint.timestamp <= span.end_time).toBe(true);
        }
        if (span.parent_id === "") {
          continue;
        }
        const parent = byId.get(span.parent_id);
        expect(parent).toBeDefined();
        expect(span.start_time >= parent!.start_time).toBe(true);
        expect(span.end_time <= parent!.end_time).toBe(true);
      }
    }
  });

  it("fills the metrics cards from the scenario, leaving the comparison side unset and the ANR cards to android", () => {
    const metrics = computeMetrics(bundle, null, {
      from: world.builtAt.minus({ days: 30 }),
      to: world.builtAt,
      group: "days",
      timezone: "UTC",
    });
    expect(metrics.crash_free_sessions.unselected_no_data).toBe(true);
    expect(metrics.cold_launch.unselected_no_data).toBe(true);
    expect(
      Math.abs(
        metrics.crash_free_sessions.crash_free_sessions -
          Math.round(scenario.app.crashFreeRate * 1000) / 10,
      ),
    ).toBeLessThanOrEqual(0.1);
    expect(
      metrics.perceived_crash_free_sessions.perceived_crash_free_sessions,
    ).toBeGreaterThanOrEqual(metrics.crash_free_sessions.crash_free_sessions);
    expect(metrics.adoption.selected_version).toBe(
      metrics.adoption.all_versions,
    );
    expect(metrics.hot_launch.p95).toBeGreaterThan(0);
    expect(metrics.warm_launch.p95).toBeGreaterThan(metrics.hot_launch.p95);
    expect(metrics.cold_launch.p95).toBeGreaterThan(metrics.warm_launch.p95);
    if (scenario.app.os === "android") {
      expect(metrics.anr_free_sessions).not.toBeNull();
      expect(metrics.perceived_anr_free_sessions).not.toBeNull();
    } else {
      expect(metrics.anr_free_sessions).toBeNull();
      expect(metrics.perceived_anr_free_sessions).toBeNull();
    }
  });

  it("attributes an error group's screen to the moment its error fired, not a later screen in the same session", () => {
    for (const group of errorGroups) {
      const instance = group.instances[0];
      const session = sessions.find(
        (s) => s.list.session_id === instance.session_id,
      )!;
      const sequence = screenSequence(session.detail.threads[mainThread] ?? []);
      let expected = "";
      for (const entry of sequence) {
        if (entry.timestamp > instance.timestamp) {
          break;
        }
        if (!entry.isFragment) {
          expected = entry.name;
        }
      }
      expect(group.screen).toBe(expected);
    }
  });

  it("keeps every timestamp in every session in UTC", () => {
    const utcTimestamp = /(Z|\+00:00)$/;
    function assertUtc(value: unknown) {
      if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
        expect(value).toMatch(utcTimestamp);
      } else if (Array.isArray(value)) {
        value.forEach(assertUtc);
      } else if (value && typeof value === "object") {
        Object.values(value).forEach(assertUtc);
      }
    }
    for (const session of sessions) {
      assertUtc(session.list);
      assertUtc(session.detail);
    }
  });
});

describe.each(apps)("sandbox routes agree: $app.name", (bundle) => {
  const appId = bundle.app.id;
  const now = world.builtAt;
  const ranges = [
    {
      name: "last 6 hours",
      from: now.minus({ hours: 6 }),
      group: "minutes",
    },
    { name: "last month", from: now.minus({ days: 30 }), group: "days" },
  ];

  async function get(path: string): Promise<any> {
    const { handleSandboxRequest } = await import("@/app/sandbox/handlers");
    const res = await handleSandboxRequest(path);
    expect(res.status).toBe(200);
    return res.json();
  }

  function query(
    range: (typeof ranges)[number],
    extra: Record<string, string> = {},
  ): string {
    return new URLSearchParams({
      from: range.from.toISO()!,
      to: now.toISO()!,
      plot_time_group: range.group,
      timezone: "UTC",
      ...extra,
    }).toString();
  }

  const seriesTotal = (series: { data: { instances: number }[] }[]) =>
    series.reduce(
      (sum, s) => sum + s.data.reduce((a, p) => a + p.instances, 0),
      0,
    );
  const idTotal = (series: any[], id: string) =>
    series
      .find((s: any) => s.id === id)!
      .data.reduce((a: number, p: any) => a + p.instances, 0);
  const crashTotal = (groups: any[]) =>
    groups
      .filter(
        (g: any) => g.error_type === "exception" && g.severity === "fatal",
      )
      .reduce((sum: number, g: any) => sum + g.count, 0);

  describe.each(ranges)("over the $name", (range) => {
    it("counts the same crashes and ANRs on the overview, the errors list and the errors plot", async () => {
      const health = await get(
        `/api/apps/${appId}/health/plots/instances?${query(range)}`,
      );
      const errors = await get(
        `/api/apps/${appId}/errorGroups?${query(range, { limit: "50", offset: "0", include_trend: "true" })}`,
      );
      expect(errors.results.length).toBeGreaterThan(0);
      const counts = errors.results.map((g: any) => g.count);
      expect(counts).toEqual([...counts].sort((a, b) => b - a));
      const anrs = errors.results
        .filter((g: any) => g.error_type === "anr")
        .reduce((sum: number, g: any) => sum + g.count, 0);
      expect(
        Math.abs(idTotal(health, "crashes") - crashTotal(errors.results)),
      ).toBeLessThanOrEqual(2);
      expect(Math.abs(idTotal(health, "anrs") - anrs)).toBeLessThanOrEqual(2);
      for (const g of errors.results) {
        expect(
          g.trend.reduce((sum: number, p: any) => sum + p.instances, 0),
        ).toBe(g.count);
      }
      const plot = await get(
        `/api/apps/${appId}/errorGroups/plots/instances?${query(range)}`,
      );
      const listed = errors.results.reduce(
        (sum: number, g: any) => sum + g.count,
        0,
      );
      expect(Math.abs(seriesTotal(plot) - listed)).toBeLessThanOrEqual(
        errors.results.length * bundle.scenario.app.versions.length,
      );
    });

    it("counts the same sessions on the overview, the sessions plot and the adoption card", async () => {
      const health = await get(
        `/api/apps/${appId}/health/plots/instances?${query(range)}`,
      );
      const plot = await get(
        `/api/apps/${appId}/sessions/plots/instances?${query(range)}`,
      );
      const metrics = await get(`/api/apps/${appId}/metrics?${query(range)}`);
      const sessions = idTotal(health, "sessions");
      expect(Math.abs(seriesTotal(plot) - sessions)).toBeLessThanOrEqual(
        bundle.scenario.app.versions.length,
      );
      expect(
        Math.abs(metrics.adoption.all_versions - sessions),
      ).toBeLessThanOrEqual(2);
      expect(metrics.adoption.selected_version).toBe(
        metrics.adoption.all_versions,
      );
    });

    it("splits a group's total the same way on its list row, its plot, its distribution and its path", async () => {
      const errors = await get(
        `/api/apps/${appId}/errorGroups?${query(range, { limit: "50", offset: "0" })}`,
      );
      const labels = bundle.scenario.app.versions.map(
        (v) => `${v.name} (${v.code})`,
      );
      for (const group of errors.results) {
        const carried = bundle.errorGroups
          .find((g) => g.id === group.id)!
          .instances.map((i) =>
            labels.indexOf(
              `${i.attribute.app_version} (${i.attribute.app_build})`,
            ),
          );
        const plot = await get(
          `/api/apps/${appId}/errorGroups/${group.id}/plots/instances?${query(range)}`,
        );
        // A group runs on every version from the oldest to the newest one its
        // instances carry.
        for (const series of plot) {
          const index = labels.indexOf(series.id);
          expect(index).toBeGreaterThanOrEqual(Math.min(...carried));
          expect(index).toBeLessThanOrEqual(Math.max(...carried));
        }
        expect(Math.abs(seriesTotal(plot) - group.count)).toBeLessThanOrEqual(
          1,
        );
        const distribution = await get(
          `/api/apps/${appId}/errorGroups/${group.id}/plots/distribution?${query(range)}`,
        );
        expect(Object.keys(distribution).sort()).toEqual([
          "app_version",
          "country",
          "device",
          "locale",
          "network_type",
          "os_version",
        ]);
        for (const dimension of Object.values(distribution) as Record<
          string,
          number
        >[]) {
          const parts = Object.values(dimension);
          expect(parts.length).toBeGreaterThan(0);
          expect(parts.reduce((a, b) => a + b, 0)).toBe(group.count);
        }
        const path = await get(
          `/api/apps/${appId}/errorGroups/${group.id}/path`,
        );
        expect(path.sessions_analyzed).toBeGreaterThan(0);
        expect(path.sessions_analyzed).toBeLessThanOrEqual(50);
      }
    });

    it("hands the journey the same crash and ANR counts the errors list reports", async () => {
      const journey = await get(`/api/apps/${appId}/journey?${query(range)}`);
      const errors = await get(
        `/api/apps/${appId}/errorGroups?${query(range, { limit: "50", offset: "0" })}`,
      );
      const byId = new Map<string, number>(
        errors.results.map((g: any) => [g.id, g.count]),
      );
      let issues = 0;
      for (const node of journey.nodes) {
        for (const issue of [...node.issues.crashes, ...node.issues.anrs]) {
          expect(
            Math.abs(issue.count - (byId.get(issue.id) ?? -1)),
          ).toBeLessThanOrEqual(1);
          issues += issue.count;
        }
      }
      expect(journey.totalIssues).toBe(issues);
    });

    it("gives every root span a reading in every bucket with its percentiles in order", async () => {
      const names = await get(`/api/apps/${appId}/spans/roots/names`);
      for (const spanName of names.results) {
        const metrics = await get(
          `/api/apps/${appId}/spans/plots/metrics?${query(range, { span_name: spanName })}`,
        );
        expect(metrics[0].data.length).toBeGreaterThan(0);
        for (const point of metrics[0].data) {
          expect(point.p50).toBeGreaterThan(0);
          expect(point.p50).toBeLessThanOrEqual(point.p90);
          expect(point.p90).toBeLessThanOrEqual(point.p95);
          expect(point.p95).toBeLessThanOrEqual(point.p99);
        }
      }
    });

    it("splits every endpoint's requests across the status codes it answers with", async () => {
      const trends = await get(
        `/api/apps/${appId}/networkRequests/trends?${query(range)}`,
      );
      for (const endpoint of bundle.networkEndpoints.values()) {
        const params = query(range, {
          domain: endpoint.domain,
          path: endpoint.path,
        });
        const statuses = await get(
          `/api/apps/${appId}/networkRequests/plots/endpointStatusCodes?${params}`,
        );
        expect(statuses.status_codes.length).toBeGreaterThan(0);
        const trend = trends.trends_frequency.find(
          (t: any) =>
            t.domain === endpoint.domain && t.path_pattern === endpoint.path,
        );
        expect(trend.frequency).toBe(
          statuses.data_points.reduce(
            (sum: number, point: any) => sum + point.total_count,
            0,
          ),
        );
        for (const point of statuses.data_points) {
          const parts = statuses.status_codes.reduce(
            (sum: number, code: number) => sum + point[`count_${code}`],
            0,
          );
          expect(parts).toBe(point.total_count);
        }
        const latency = await get(
          `/api/apps/${appId}/networkRequests/plots/latency?${params}`,
        );
        for (const point of latency) {
          expect(point.p50).toBeLessThanOrEqual(point.p95);
        }
      }
      const statusCodes = await get(
        `/api/apps/${appId}/networkRequests/plots/statusCodes?${query(range)}`,
      );
      for (const point of statusCodes) {
        expect(
          point.count_2xx + point.count_3xx + point.count_4xx + point.count_5xx,
        ).toBe(point.total_count);
      }
    });
  });

  it("draws a plot's first and last bucket from data rather than ending it at zero", async () => {
    const plot = await get(
      `/api/apps/${appId}/health/plots/instances?${query(ranges[0])}`,
    );
    const sessions = plot.find((s: any) => s.id === "sessions")!;
    expect(sessions.data[0].instances).toBeGreaterThan(0);
    expect(sessions.data[sessions.data.length - 1].instances).toBeGreaterThan(
      0,
    );
  });

  it("offers only filter values the sessions carry, and finds sessions for each one", async () => {
    const attributeOf: Record<string, (s: any) => string> = {
      version_name: (s) => s.list.attribute.app_version,
      device_name: (s) => s.list.attribute.device_name,
    };
    for (const [key, read] of Object.entries(attributeOf)) {
      const carried = new Set(bundle.sessions.map(read));
      const values = await get(
        `/api/apps/${appId}/filters/values?entity=sessions&key_name=${key}`,
      );
      expect(values.values.length).toBeGreaterThan(0);
      for (const value of values.values) {
        expect(carried.has(value.text)).toBe(true);
        const sessions = await get(
          `/api/apps/${appId}/sessions?${query(ranges[1], {
            limit: "50",
            offset: "0",
            filter_expr: `${key}:in:${value.text}`,
          })}`,
        );
        expect(sessions.results.length).toBeGreaterThan(0);
      }
    }
  });

  it("ends a common path on the error's severity and the thread the error was recorded on", async () => {
    const prefixes: Record<string, string> = {
      anr: "ANR: ",
      fatal: "Crash: ",
      unhandled: "Unhandled error: ",
      handled: "Handled error: ",
    };
    for (const group of bundle.errorGroups) {
      const path = await get(`/api/apps/${appId}/errorGroups/${group.id}/path`);
      const last = path.steps[path.steps.length - 1];
      const expected =
        group.error_type === "anr" ? prefixes.anr : prefixes[group.severity];
      expect(last.description.startsWith(expected)).toBe(true);
      const instance = group.instances[0];
      const event = Object.values(
        bundle.sessions.find((s) => s.list.session_id === instance.session_id)!
          .detail.threads,
      )
        .flat()
        .find(
          (e) =>
            e.timestamp === instance.timestamp &&
            (e.event_type === "error" || e.event_type === "anr"),
        )!;
      expect(last.thread_name).toBe(event.thread_name);
      expect(last.confidence_pct).toBe(100);
      expect(path.steps.length).toBeGreaterThan(3);
    }
  });

  it("keeps the errors plot on the versions the filter selected", async () => {
    const version = bundle.scenario.app.versions[0];
    const plot = await get(
      `/api/apps/${appId}/errorGroups/plots/instances?${query(ranges[1], {
        filter_expr: `version_name:in:${version.name}`,
      })}`,
    );
    expect(plot.map((series: any) => series.id)).toEqual([
      `${version.name} (${version.code})`,
    ]);
  });

  it("scales a month's numbers down to the six hours the filter bar opens on", async () => {
    const month = await get(
      `/api/apps/${appId}/health/plots/instances?${query(ranges[1])}`,
    );
    const sixHours = await get(
      `/api/apps/${appId}/health/plots/instances?${query(ranges[0])}`,
    );
    const monthSessions = idTotal(month, "sessions");
    const sixHourSessions = idTotal(sixHours, "sessions");
    expect(monthSessions).toBe(bundle.scenario.app.dailySessions * 30);
    // Six hours is 1/120 of the month, and the time of day moves the share a few times either way.
    expect(sixHourSessions).toBeGreaterThan(monthSessions * 0.002);
    expect(sixHourSessions).toBeLessThan(monthSessions * 0.02);
  });

  it("narrows every page by the same fraction when one version is selected", async () => {
    const version = bundle.scenario.app.versions[0];
    const filtered = query(ranges[1], {
      filter_expr: `version_name:in:${version.name}`,
    });
    const all = query(ranges[1]);
    const sessionsAll = seriesTotal(
      await get(`/api/apps/${appId}/sessions/plots/instances?${all}`),
    );
    const sessionsOne = seriesTotal(
      await get(`/api/apps/${appId}/sessions/plots/instances?${filtered}`),
    );
    const share = sessionsOne / sessionsAll;
    expect(share).toBeGreaterThan(0);
    expect(share).toBeLessThan(1);
    const metrics = await get(`/api/apps/${appId}/metrics?${filtered}`);
    expect(metrics.adoption.adoption / 100).toBeCloseTo(share, 2);
    const journeyAll = await get(`/api/apps/${appId}/journey?${all}`);
    const journeyOne = await get(`/api/apps/${appId}/journey?${filtered}`);
    const linkTotal = (j: any) =>
      j.links.reduce((sum: number, l: any) => sum + l.value, 0);
    expect(linkTotal(journeyOne) / linkTotal(journeyAll)).toBeCloseTo(share, 2);
    const health = await get(
      `/api/apps/${appId}/health/plots/instances?${filtered}`,
    );
    const errors = await get(
      `/api/apps/${appId}/errorGroups?${filtered}&limit=50&offset=0`,
    );
    expect(
      Math.abs(idTotal(health, "crashes") - crashTotal(errors.results)),
    ).toBeLessThanOrEqual(2);
    const crashFree =
      Math.round(
        (1 - idTotal(health, "crashes") / metrics.adoption.selected_version) *
          1000,
      ) / 10;
    expect(
      Math.abs(metrics.crash_free_sessions.crash_free_sessions - crashFree),
    ).toBeLessThanOrEqual(0.1);
  });

  it("spreads a session's requests over the session, so the timeline slider has room to move", async () => {
    const timeline = await get(
      `/api/apps/${appId}/networkRequests/plots/timeline?${query(ranges[1])}`,
    );
    const maxElapsed = Math.max(
      ...timeline.points.map((p: { elapsed: number }) => p.elapsed),
    );
    expect(maxElapsed).toBeGreaterThanOrEqual(15);
    for (const point of timeline.points) {
      expect(point.count).toBeGreaterThan(0);
    }
  });
});

describe("catalog ids are stable across rebuilds", () => {
  it("keeps every session, group and trace id identical between two independent builds", async () => {
    jest.resetModules();
    const second = await import("@/app/sandbox/catalog");
    const rebuilt = second.catalog();
    expect(rebuilt).not.toBe(world);
    for (const [appId, bundle] of rebuilt.appById) {
      const original = world.appById.get(appId)!;
      expect(bundle.sessions.map((s) => s.list.session_id)).toEqual(
        original.sessions.map((s) => s.list.session_id),
      );
      expect(bundle.errorGroups.map((g) => g.id)).toEqual(
        original.errorGroups.map((g) => g.id),
      );
      expect(Array.from(bundle.traces.keys())).toEqual(
        Array.from(original.traces.keys()),
      );
      expect(bundle.app.id).toBe(original.app.id);
    }
  });
});

describe.each(apps)("session stories: $app.name", (bundle) => {
  const mainThread = bundle.scenario.threadNames.main;
  const events = (session: (typeof bundle.sessions)[number]) =>
    Object.values(session.detail.threads).flat();

  it("prices each checkout from the cart the payment screen showed when place order was tapped", () => {
    let checked = 0;
    for (const session of bundle.sessions) {
      const paymentTaps = events(session).filter(
        (e) =>
          e.event_type === "gesture_click" &&
          parseState(
            decodeToken((e.attachments as { key: string }[])[0].key)!.state,
          ).screen === "payment",
      );
      for (const ref of session.detail.traces) {
        if (ref.trace_name !== "checkout_flow") {
          continue;
        }
        const tap = paymentTaps
          .filter((e) => e.timestamp <= ref.start_time)
          .at(-1)!;
        const token = decodeToken(
          (tap.attachments as { key: string }[])[0].key,
        )!;
        const { shop } = parseState(token.state);
        expect(shop.cart.length).toBeGreaterThan(0);
        const root = bundle.traces
          .get(ref.trace_id)!
          .spans.find((s) => s.parent_id === "")!;
        const total = orderTotals(shop.cart, shop.coupon, shop.express).total;
        expect(root.user_defined_attributes?.cart_total).toBe(
          (total / 100).toFixed(2),
        );
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("records every request a span stands for as a network event with the span's timing", () => {
    const requestSpanNames = new Set<string>();
    const collect = (spec: SpanSpec) => {
      if (spec.http) {
        requestSpanNames.add(spec.name);
      }
      spec.children?.forEach(collect);
    };
    bundle.scenario.spans.forEach(collect);
    for (const session of bundle.sessions) {
      const requests = events(session).filter((e) => e.event_type === "http");
      for (const ref of session.detail.traces) {
        for (const span of bundle.traces.get(ref.trace_id)!.spans) {
          if (!requestSpanNames.has(span.span_name)) {
            continue;
          }
          const start = DateTime.fromISO(span.start_time).toMillis();
          expect(
            requests.some(
              (e) => e.start_time === start && e.duration === span.duration,
            ),
          ).toBe(true);
        }
      }
    }
  });

  it("reports an ANR only after five seconds without a main-thread event", () => {
    for (const session of bundle.sessions) {
      const main = session.detail.threads[mainThread] ?? [];
      main.forEach((event, i) => {
        if (event.event_type !== "anr") {
          return;
        }
        const silence =
          DateTime.fromISO(event.timestamp).toMillis() -
          DateTime.fromISO(main[i - 1].timestamp).toMillis();
        expect(silence).toBeGreaterThanOrEqual(5_000);
      });
    }
  });
});

describe("sandbox bug reports", () => {
  it("gives every report its own description and leaves some open and some closed", () => {
    const reports = apps.flatMap((b) => b.bugReports);
    expect(new Set(reports.map((r) => r.description)).size).toBe(
      reports.length,
    );
    expect(reports.some((r) => r.status === 0)).toBe(true);
    expect(reports.some((r) => r.status === 1)).toBe(true);
  });
});
