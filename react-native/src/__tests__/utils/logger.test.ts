import { MeasureLogger } from '../../utils/logger';

jest.mock('../../native/measureBridge', () => ({
  internalAddLog: jest.fn(() => Promise.resolve()),
}));

const { internalAddLog } = jest.requireMock('../../native/measureBridge');

describe('MeasureLogger diagnostic mode', () => {
  beforeEach(() => {
    (internalAddLog as jest.Mock).mockClear();
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not call internalAddLog when diagnostic mode is off', () => {
    const logger = new MeasureLogger('test', true, false, false);

    logger.log('info', 'hello');

    expect(internalAddLog).not.toHaveBeenCalled();
  });

  it('forwards just the message when no error is provided', () => {
    const logger = new MeasureLogger('test', true, false, true);

    logger.log('info', 'a message');

    expect(internalAddLog).toHaveBeenCalledWith('react-native', 'a message');
  });

  it('appends error.stack (already containing message) without duplicating the message', () => {
    const logger = new MeasureLogger('test', true, false, true);
    const err = new Error('boom');
    err.stack = 'Error: boom\n    at thing (file.js:1:1)';

    logger.log('error', 'failed', err);

    expect(internalAddLog).toHaveBeenCalledWith(
      'react-native',
      `failed\n${err.stack}`
    );
    const composed = (internalAddLog as jest.Mock).mock.calls[0][1] as string;
    expect(composed.match(/boom/g)).toHaveLength(1);
  });

  it('falls back to error.message when error.stack is undefined', () => {
    const logger = new MeasureLogger('test', true, false, true);
    const err = new Error('boom');
    err.stack = undefined;

    logger.log('error', 'failed', err);

    expect(internalAddLog).toHaveBeenCalledWith(
      'react-native',
      'failed\nboom'
    );
  });

  it('uses String(error) for non-Error values', () => {
    const logger = new MeasureLogger('test', true, false, true);

    logger.log('error', 'failed', { code: 42, toString: () => '<obj>' });

    expect(internalAddLog).toHaveBeenCalledWith(
      'react-native',
      'failed\n<obj>'
    );
  });

  it('swallows errors thrown by internalAddLog', () => {
    (internalAddLog as jest.Mock).mockReturnValueOnce(
      Promise.reject(new Error('forced'))
    );
    const logger = new MeasureLogger('test', true, false, true);

    expect(() => logger.log('info', 'x')).not.toThrow();
  });
});
