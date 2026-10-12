import type { Logger } from '../utils/logger';
import {
  dropInvalidAttributes,
  type ValidAttributeValue,
} from '../utils/attributeValueValidator';
import { ValidationLimits } from '../utils/validationLimits';
import { launchBugReport, trackBugReport } from '../native/measureBridge';
import type { MsrAttachment } from '../events/msrAttachment';

export interface IBugReportCollector {
  register(): void;
  unregister(): void;

  launchBugReport(params?: {
    takeScreenshot?: boolean;
    bugReportConfig?: Record<string, any>;
    attributes?: Record<string, ValidAttributeValue>;
  }): Promise<void>;

  trackBugReport(params: {
    description: string;
    attachments?: MsrAttachment[];
    attributes?: Record<string, ValidAttributeValue>;
  }): Promise<void>;
}

export class BugReportCollector implements IBugReportCollector {
  private logger: Logger;
  private isRegistered = false;

  constructor(opts: { logger: Logger }) {
    this.logger = opts.logger;
  }

  register(): void {
    if (this.isRegistered) {
      this.logger.internalLog(
        'debug',
        '[BugReportCollector] Already registered.'
      );
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

  async trackBugReport({
    description,
    attachments = [],
    attributes = {},
  }: {
    description: string;
    attachments?: MsrAttachment[];
    attributes?: Record<string, ValidAttributeValue>;
  }): Promise<void> {
    if (!this.isRegistered) {
      this.logger.internalLog(
        'warning',
        'Measure SDK is stopped. trackBugReport() will be ignored.'
      );
      return;
    }

    if (description.length > ValidationLimits.bugReportDescription) {
      this.logger.log(
        'warning',
        `Bug report description exceeds maximum length of ${ValidationLimits.bugReportDescription} characters and will be truncated`
      );
    }
    const sanitizedDescription = description.slice(
      0,
      ValidationLimits.bugReportDescription
    );
    const validAttributes = dropInvalidAttributes(
      'bug_report',
      attributes,
      this.logger
    );

    try {
      this.logger.internalLog(
        'info',
        '[BugReportCollector] Tracking bug report...',
        {
          description: sanitizedDescription,
          attachments,
          attributes: validAttributes,
        }
      );

      await trackBugReport(sanitizedDescription, attachments, validAttributes);
    } catch (err: any) {
      this.logger.internalLog(
        'error',
        `[BugReportCollector] trackBugReport failed: ${err}`
      );
      throw err;
    }
  }

  async launchBugReport({
    takeScreenshot = true,
    bugReportConfig = {},
    attributes = {},
  }: {
    takeScreenshot?: boolean;
    bugReportConfig?: Record<string, any>;
    attributes?: Record<string, ValidAttributeValue>;
  } = {}): Promise<void> {
    if (!this.isRegistered) {
      this.logger.internalLog(
        'warning',
        'Measure SDK is stopped. launchBugReport() will be ignored.'
      );
      return;
    }

    const validAttributes = dropInvalidAttributes(
      'bug_report',
      attributes,
      this.logger
    );

    this.logger.internalLog(
      'info',
      '[BugReportCollector] Launching native bug report UI...',
      {
        takeScreenshot,
        bugReportConfig,
        attributes: validAttributes,
      }
    );

    return launchBugReport(takeScreenshot, bugReportConfig, validAttributes);
  }
}
