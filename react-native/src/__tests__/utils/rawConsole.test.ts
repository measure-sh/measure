import { rawConsole, setRawConsole } from '../../utils/rawConsole';

describe('rawConsole', () => {
  afterEach(() => {
    setRawConsole(null);
    jest.restoreAllMocks();
  });

  it('delegates to the live global console when no override is set', () => {
    const spy = jest.spyOn(console, 'info').mockImplementation(() => {});

    rawConsole.info('hello');

    expect(spy).toHaveBeenCalledWith('hello');
  });

  it('delegates to the override when set', () => {
    const override = {
      debug: jest.fn(),
      log: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    setRawConsole(override);

    rawConsole.warn('patched');

    expect(override.warn).toHaveBeenCalledWith('patched');
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns to the live global console when the override is cleared', () => {
    setRawConsole({
      debug: jest.fn(),
      log: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    });
    setRawConsole(null);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    rawConsole.error('back to live');

    expect(spy).toHaveBeenCalledWith('back to live');
  });
});
