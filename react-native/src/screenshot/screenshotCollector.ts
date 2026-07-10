import { internalConsole } from '../utils/internalConsole';
import type { MsrAttachment } from '../events/msrAttachment';
import { captureScreenshot } from '../native/measureBridge';

export interface IScreenshotCollector {
  capture(): Promise<MsrAttachment | null>;
}

export class ScreenshotCollector implements IScreenshotCollector {
  async capture(): Promise<MsrAttachment | null> {
    try {
      const attachment = await captureScreenshot();

      return attachment as MsrAttachment;
    } catch (err) {
      internalConsole.warn('[ScreenshotCollector] capture failed:', err);
      return null;
    }
  }
}
