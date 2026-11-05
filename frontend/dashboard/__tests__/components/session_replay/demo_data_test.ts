import { replayFrom } from "@/app/components/session_replay/replay";
import { demoSession } from "@/app/components/session_replay/demo_data";

describe("the demo session", () => {
  it("assigns a unique id to each screen", () => {
    // Attachments are cached by their session id. If two screens share an id,
    // they would be drawn as the same screen.
    const ids = replayFrom(demoSession).attachmentRefs.map(
      (attachmentRef) => attachmentRef.id,
    );

    expect(ids.length).toBeGreaterThan(1);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
