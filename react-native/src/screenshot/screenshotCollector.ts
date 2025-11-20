import type { MsrAttachment } from '../events/msrAttachment';
import { captureScreenshot } from '../native/measureBridge';

export interface IScreenshotCollector {
  capture(): Promise<MsrAttachment | null>;
}

export class ScreenshotCollector implements IScreenshotCollector {
  async capture(): Promise<MsrAttachment | null> {
    try {
      const screenshot = await captureScreenshot();

      if (!screenshot?.base64) {
        return null;
      }

      const { base64 } = screenshot;

      // Rough size estimate (Base64 → bytes = ~0.75 * length)
      const size = Math.round((base64.length * 3) / 4);

      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const name = `screenshot-${id}.png`;

      const attachment: MsrAttachment = {
        name,
        type: 'screenshot',
        bytes: base64,
        path: null,
        size,
        id,
      };

      return attachment;
    } catch (err) {
      console.warn('[ScreenshotCollector] capture failed:', err);
      return null;
    }
  }
}