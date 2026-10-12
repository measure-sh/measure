import { BugReportCollector } from '../../bugReport/bugReportCollector';
import { launchBugReport, trackBugReport } from '../../native/measureBridge';

jest.mock('../../native/measureBridge', () => ({
  launchBugReport: jest.fn(() => Promise.resolve()),
  trackBugReport: jest.fn(() => Promise.resolve()),
}));

describe('BugReportCollector', () => {
  let logger: { log: jest.Mock; internalLog: jest.Mock };
  let collector: BugReportCollector;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = { log: jest.fn(), internalLog: jest.fn() };
    collector = new BugReportCollector({ logger: logger as any });
    collector.register();
  });

  describe('trackBugReport', () => {
    it('tracks a bug report with a description of 4000 characters', async () => {
      const description = 'd'.repeat(4000);

      await collector.trackBugReport({ description });

      expect(trackBugReport).toHaveBeenCalledWith(description, [], {});
      expect(logger.log).not.toHaveBeenCalled();
    });

    it('truncates a description longer than 4000 characters', async () => {
      await collector.trackBugReport({ description: 'd'.repeat(4001) });

      expect(trackBugReport).toHaveBeenCalledWith('d'.repeat(4000), [], {});
      expect(logger.log).toHaveBeenCalledWith(
        'warning',
        'Bug report description exceeds maximum length of 4000 characters and will be truncated'
      );
    });

    it('drops invalid attributes and keeps the bug report', async () => {
      await collector.trackBugReport({
        description: 'Bug',
        attributes: { 'screen': 'Home', 'a.b': 'value' },
      });

      expect(trackBugReport).toHaveBeenCalledWith('Bug', [], {
        screen: 'Home',
      });
      expect(logger.log).toHaveBeenCalledWith(
        'warning',
        'Invalid attributes for bug_report: dropped 1 attributes'
      );
    });

    it('does nothing when not registered', async () => {
      collector.unregister();

      await collector.trackBugReport({ description: 'Bug' });

      expect(trackBugReport).not.toHaveBeenCalled();
    });
  });

  describe('launchBugReport', () => {
    it('drops invalid attributes before launching', async () => {
      await collector.launchBugReport({
        takeScreenshot: false,
        attributes: { 'screen': 'Home', 'a.b': 'value' },
      });

      expect(launchBugReport).toHaveBeenCalledWith(
        false,
        {},
        { screen: 'Home' }
      );
      expect(logger.log).toHaveBeenCalledWith(
        'warning',
        'Invalid attributes for bug_report: dropped 1 attributes'
      );
    });
  });
});
