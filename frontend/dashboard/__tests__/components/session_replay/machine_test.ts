import { createActor, waitFor as machineWaitFor } from "xstate";
import {
  sessionReplayMachine,
  shownAttachmentRefOf,
  tickOffsetMs,
} from "@/app/components/session_replay/machine";

const start = "2026-05-26T10:00:00.000Z";

const at = (seconds: number) =>
  new Date(Date.parse(start) + seconds * 1000).toISOString();

function timelineWith(events: any[], traces: any[] = []) {
  return { threads: { main: events }, traces };
}

function attachment(type: string, name: string) {
  return { id: name, name, type, key: "k", location: `https://cdn/${name}` };
}

describe("tickOffsetMs", () => {
  it("advances by the time a frame took", () => {
    expect(tickOffsetMs(1000, 16, 1, 60_000)).toBe(1016);
  });

  it("advances by the playback speed on top of that", () => {
    expect(tickOffsetMs(1000, 16, 4, 60_000)).toBe(1064);
  });

  it("caps elapsed time after a tab was in the background", () => {
    // After thirty seconds away from the tab, advance the playhead by the
    // cap instead of the full elapsed time.
    expect(tickOffsetMs(1000, 30_000, 1, 600_000)).toBe(1250);
    expect(tickOffsetMs(1000, 30_000, 4, 600_000)).toBe(2000);
  });

  it("stops at the end of the replay", () => {
    expect(tickOffsetMs(59_900, 200, 4, 60_000)).toBe(60_000);
  });
});

describe("the machine", () => {
  const tenIdleSeconds = {
    threads: {
      main: [
        { event_type: "lifecycle_app", timestamp: "2026-04-10T10:00:00Z" },
        { event_type: "lifecycle_app", timestamp: "2026-04-10T10:00:10Z" },
      ],
    },
    traces: [],
  };

  const tiltableMachine = sessionReplayMachine.provide({
    guards: { isShownAttachmentTiltable: () => true },
  });

  async function readyMachine(session: unknown = tenIdleSeconds) {
    const actor = createActor(sessionReplayMachine).start();
    actor.send({ type: "replay.received", session });
    await machineWaitFor(actor, (s) => s.matches("ready"), { timeout: 2000 });
    return actor;
  }

  it("is ready to play the moment the session arrives", async () => {
    const actor = createActor(sessionReplayMachine).start();
    actor.send({ type: "replay.received", session: tenIdleSeconds });

    // The replay is built in one pass, so playback is ready before the
    // attachments finish loading.
    expect(actor.getSnapshot().matches({ ready: { playback: "paused" } })).toBe(
      true,
    );
    actor.send({ type: "user.seek", toOffsetMs: 3000 });
    expect(actor.getSnapshot().context.playheadOffsetMs).toBe(3000);
    actor.send({ type: "user.toggle" });
    expect(
      actor.getSnapshot().matches({ ready: { playback: "playing" } }),
    ).toBe(true);
    actor.stop();
  });

  const twoAttachments = timelineWith([
    {
      event_type: "gesture_click",
      timestamp: at(0),
      x: 1,
      y: 1,
      attachments: [
        attachment("layout_snapshot_json", "tree.json"),
        attachment("screenshot", "shot.webp"),
      ],
    },
  ]);

  it("shows the first attachment listed by the session", async () => {
    const actor = await readyMachine(twoAttachments);

    expect(shownAttachmentRefOf(actor.getSnapshot().context)?.id).toBe(
      "tree.json",
    );
    actor.stop();
  });

  it("shows the attachment selected in the switcher", async () => {
    const actor = await readyMachine(twoAttachments);

    actor.send({ type: "user.selectAttachment", index: 1 });

    expect(shownAttachmentRefOf(actor.getSnapshot().context)?.id).toBe(
      "shot.webp",
    );
    actor.stop();
  });

  it("turns a layout tree and leaves a screenshot flat", async () => {
    const actor = await readyMachine(twoAttachments);
    const press = {
      type: "user.pointerDown" as const,
      x: 10,
      y: 10,
      button: 0,
      screenScale: 1,
    };

    // The first attachment is a layout tree with layers that can be tilted.
    actor.send(press);
    expect(
      actor.getSnapshot().matches({ ready: { inspection: "dragging" } }),
    ).toBe(true);
    actor.send({ type: "user.pointerUp" });

    // The screenshot of the same screen is flat, so it cannot be tilted.
    actor.send({ type: "user.selectAttachment", index: 1 });
    actor.send(press);
    expect(
      actor.getSnapshot().matches({ ready: { inspection: "dragging" } }),
    ).toBe(false);
    actor.stop();
  });

  it("starts a drag on a primary press and ends it when the slice changes", async () => {
    const actor = createActor(tiltableMachine).start();
    actor.send({ type: "replay.received", session: tenIdleSeconds });
    await machineWaitFor(actor, (s) => s.matches("ready"), { timeout: 2000 });
    actor.send({
      type: "user.pointerDown",
      x: 10,
      y: 10,
      button: 0,
      screenScale: 1,
    });
    expect(
      actor.getSnapshot().matches({ ready: { inspection: "dragging" } }),
    ).toBe(true);
    expect(actor.getSnapshot().context.dragOrigin).not.toBeNull();

    actor.send({ type: "slice.changed" });
    expect(actor.getSnapshot().matches({ ready: { inspection: "idle" } })).toBe(
      true,
    );
    expect(actor.getSnapshot().context.dragOrigin).toBeNull();
    actor.stop();
  });

  it("ignores a press that is not the primary button", async () => {
    const actor = createActor(tiltableMachine).start();
    actor.send({ type: "replay.received", session: tenIdleSeconds });
    await machineWaitFor(actor, (s) => s.matches("ready"), { timeout: 2000 });
    actor.send({
      type: "user.pointerDown",
      x: 10,
      y: 10,
      button: 2,
      screenScale: 1,
    });
    expect(actor.getSnapshot().matches({ ready: { inspection: "idle" } })).toBe(
      true,
    );
    actor.stop();
  });

  it("ends a drag when a move reports every button released", async () => {
    const actor = createActor(tiltableMachine).start();
    actor.send({ type: "replay.received", session: tenIdleSeconds });
    await machineWaitFor(actor, (s) => s.matches("ready"), { timeout: 2000 });
    actor.send({
      type: "user.pointerDown",
      x: 10,
      y: 10,
      button: 0,
      screenScale: 1,
    });
    actor.send({
      type: "user.pointerMove",
      x: 20,
      y: 10,
      buttons: 0,
      hoverLabel: null,
    });
    expect(actor.getSnapshot().matches({ ready: { inspection: "idle" } })).toBe(
      true,
    );
    actor.stop();
  });

  it("turns the tilt pose with a drag, scaled by the press's screen scale", async () => {
    const actor = createActor(tiltableMachine).start();
    actor.send({ type: "replay.received", session: tenIdleSeconds });
    await machineWaitFor(actor, (s) => s.matches("ready"), { timeout: 2000 });
    const resting = actor.getSnapshot().context.tilt;
    actor.send({
      type: "user.pointerDown",
      x: 10,
      y: 10,
      button: 0,
      screenScale: 1,
    });
    actor.send({
      type: "user.pointerMove",
      x: 20,
      y: 10,
      buttons: 1,
      hoverLabel: null,
    });
    expect(actor.getSnapshot().context.tilt).toEqual({
      xDegrees: resting.xDegrees,
      yDegrees: resting.yDegrees + 5,
    });
    actor.stop();
  });

  it("keeps the selected index when no attachment group is available", async () => {
    const actor = await readyMachine();
    actor.send({ type: "user.selectAttachment", index: 2 });

    // This session has no attachments, so the selection has no group key.
    // The stage shows the first attachment in any group it reaches.
    expect(actor.getSnapshot().context.attachmentSwitcher).toEqual({
      eventKey: null,
      shownIndex: 2,
    });
    actor.stop();
  });

  it("skips an idle gap on a tick and records its duration", async () => {
    const actor = await readyMachine();
    actor.send({ type: "user.toggleIdleSkip" });
    actor.send({ type: "user.toggle" });
    actor.send({ type: "clock.tick", clockOffsetMs: 1 });

    // The final lifecycle event can carry a layout snapshot, so the skip
    // stops before that event instead of continuing to the end.
    expect(actor.getSnapshot().context.playheadOffsetMs).toBe(9500);
    expect(actor.getSnapshot().context.skippedIdleMs).toBe(9499);
    expect(actor.getSnapshot().matches({ ready: { notice: "visible" } })).toBe(
      true,
    );
    actor.stop();
  });

  it("plays on after skipping a gap in the middle of a session", async () => {
    // The target is inside its own slice, so the playhead lands on that
    // slice. Playback must continue from there instead of skipping again.
    const actor = await readyMachine({
      threads: {
        main: [
          {
            event_type: "gesture_click",
            thread_name: "main",
            x: 1,
            y: 1,
            timestamp: "2026-04-10T10:00:00Z",
          },
          {
            event_type: "gesture_click",
            thread_name: "main",
            x: 1,
            y: 1,
            timestamp: "2026-04-10T10:01:00Z",
          },
        ],
      },
      traces: [],
    });
    actor.send({ type: "user.toggleIdleSkip" });
    actor.send({ type: "user.seek", toOffsetMs: 1000 });
    actor.send({ type: "user.toggle" });
    actor.send({ type: "clock.tick", clockOffsetMs: 1016 });

    expect(actor.getSnapshot().context.playheadOffsetMs).toBe(59_500);
    expect(actor.getSnapshot().context.skippedIdleMs).toBe(58_484);

    actor.send({ type: "clock.tick", clockOffsetMs: 59_516 });
    expect(actor.getSnapshot().context.playheadOffsetMs).toBe(59_516);
    expect(
      actor.getSnapshot().matches({ ready: { playback: "playing" } }),
    ).toBe(true);
    actor.stop();
  });

  it("rewinds when play is pressed after seeking to the end", async () => {
    const actor = await readyMachine();
    const durationMs = actor.getSnapshot().context.replay!.durationMs;
    actor.send({ type: "user.seek", toOffsetMs: durationMs });
    actor.send({ type: "user.toggle" });

    expect(actor.getSnapshot().context.playheadOffsetMs).toBe(0);
    expect(
      actor.getSnapshot().matches({ ready: { playback: "playing" } }),
    ).toBe(true);
    actor.stop();
  });

  it("ends playback at the duration and restarts from the beginning", async () => {
    const actor = await readyMachine();
    actor.send({ type: "user.toggle" });
    actor.send({ type: "clock.tick", clockOffsetMs: 99999 });
    expect(actor.getSnapshot().matches({ ready: { playback: "ended" } })).toBe(
      true,
    );
    expect(actor.getSnapshot().context.playheadOffsetMs).toBe(10000);

    actor.send({ type: "user.toggle" });
    expect(
      actor.getSnapshot().matches({ ready: { playback: "playing" } }),
    ).toBe(true);
    expect(actor.getSnapshot().context.playheadOffsetMs).toBe(0);
    actor.stop();
  });

  it("ignores a clock tick while paused", async () => {
    const actor = await readyMachine();
    actor.send({ type: "user.seek", toOffsetMs: 4000 });
    actor.send({ type: "clock.tick", clockOffsetMs: 99999 });
    expect(actor.getSnapshot().matches({ ready: { playback: "paused" } })).toBe(
      true,
    );
    expect(actor.getSnapshot().context.playheadOffsetMs).toBe(4000);
    actor.stop();
  });

  it("shows the skip notice and hides it after the delay", async () => {
    const quickNotice = sessionReplayMachine.provide({
      delays: { noticeDelay: 20 },
    });
    const actor = createActor(quickNotice).start();
    actor.send({ type: "replay.received", session: tenIdleSeconds });
    await machineWaitFor(actor, (s) => s.matches("ready"), { timeout: 2000 });

    actor.send({ type: "user.toggleIdleSkip" });
    actor.send({ type: "user.toggle" });
    actor.send({ type: "clock.tick", clockOffsetMs: 1 });
    expect(actor.getSnapshot().matches({ ready: { notice: "visible" } })).toBe(
      true,
    );

    await machineWaitFor(
      actor,
      (s) => s.matches({ ready: { notice: "hidden" } }),
      { timeout: 2000 },
    );
    expect(actor.getSnapshot().context.skippedIdleMs).toBeNull();
    actor.stop();
  });
});
