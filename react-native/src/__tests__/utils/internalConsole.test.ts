import {
  internalConsole,
  setInternalConsole,
} from '../../utils/internalConsole';

describe('internalConsole', () => {
  afterEach(() => {
    setInternalConsole(null);
    jest.restoreAllMocks();
  });

  it('delegates to the live global console when no override is set', () => {
    const spy = jest.spyOn(console, 'info').mockImplementation(() => {});

    internalConsole.info('hello');

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
    setInternalConsole(override);

    internalConsole.warn('patched');

    expect(override.warn).toHaveBeenCalledWith('patched');
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns to the live global console when the override is cleared', () => {
    setInternalConsole({
      debug: jest.fn(),
      log: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    });
    setInternalConsole(null);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    internalConsole.error('back to live');

    expect(spy).toHaveBeenCalledWith('back to live');
  });
});
