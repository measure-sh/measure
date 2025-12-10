import type { Logger } from '../utils/logger';
import type { ValidAttributeValue } from '../utils/attributeValueValidator';
import { launchBugReport, trackBugReport } from '../native/measureBridge';
import type { MsrAttachment } from '../events/msrAttachment';

export interface IBugReportCollector {
  register(): void;
  unregister(): void;

  launchBugReport(
    takeScreenshot?: boolean,
    bugReportConfig?: Record<string, any>,
    attributes?: Record<string, ValidAttributeValue>
  ): Promise<void>;

  trackBugReport(
    description: string,
    attachments?: MsrAttachment[],
    attributes?: Record<string, ValidAttributeValue>
  ): Promise<void>;
}

export class BugReportCollector implements IBugReportCollector {
  private logger: Logger;
  private isRegistered = false;

  constructor(opts: { logger: Logger }) {
    this.logger = opts.logger;
  }

  register(): void {
    if (this.isRegistered) {
      this.logger.internalLog('debug', '[BugReportCollector] Already registered.');
      return;
    }
    this.isRegistered = true;
    this.logger.internalLog('info', '[BugReportCollector] Registered.');
  }

  unregister(): void {
    if (!this.isRegistered) {
      this.logger.internalLog('debug', '[BugReportCollector] Not registered.');
      return;
    }
    this.isRegistered = false;
    this.logger.internalLog('info', '[BugReportCollector] Unregistered.');
  }

  async trackBugReport(
    description: string,
    attachments: MsrAttachment[] = [],
    attributes: Record<string, ValidAttributeValue> = {}
  ): Promise<void> {
    try {
      this.logger.internalLog('info', '[BugReportCollector] Tracking bug report...', {
        description,
        attachments,
        attributes,
      });

      await trackBugReport(description, attachments, attributes);
    } catch (err: any) {
      this.logger.internalLog('error', `[BugReportCollector] trackBugReport failed: ${err}`);
      throw err;
    }
  }

  async launchBugReport(
    takeScreenshot: boolean = true,
    bugReportConfig: Record<string, any> = {},
    attributes: Record<string, ValidAttributeValue> = {}
  ): Promise<void> {
    this.logger.internalLog('info', '[BugReportCollector] Launching native bug report UI...', {
      takeScreenshot,
      bugReportConfig,
      attributes,
    });

    launchBugReport(takeScreenshot, bugReportConfig, attributes);
  }
}