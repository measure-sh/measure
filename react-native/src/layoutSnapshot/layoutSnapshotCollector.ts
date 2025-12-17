import type { MsrAttachment } from "../events/msrAttachment";
import { captureLayoutSnapshot } from "../native/measureBridge";

export interface ILayoutSnapshotCollector {
  capture(): Promise<MsrAttachment | null>;
}

export class LayoutSnapshotCollector implements ILayoutSnapshotCollector {
  async capture(): Promise<MsrAttachment | null> {
    try {
      const attachment = await captureLayoutSnapshot();

      return attachment as MsrAttachment;
    } catch (err) {
      console.warn('[LayoutSnapshotCollector] capture failed:', err);
      return null;
    }
  }
}