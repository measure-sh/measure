import { buildExceptionPayload } from '../../exception/exceptionBuilder';

describe('buildExceptionPayload', () => {
  it('builds payload for Error object', () => {
    const err = new Error('Something went wrong');
    err.stack = `Error: Something went wrong
    at myFunc (/src/index.js:12:34)`;

    const payload = buildExceptionPayload(err, 'handled');

    expect(payload.exceptions).toBeDefined();
    expect(payload.exceptions.length).toBeGreaterThan(0);

    const exception = payload.exceptions[0];
    expect(exception).toBeDefined();
    expect(exception?.message).toBe('Something went wrong');
    expect(exception?.frames && exception.frames[0]).toMatchObject({
      method_name: 'myFunc',
      file_name: 'app:///index.js',
      line_num: 12,
      col_num: 34,
      in_app: true,
    });
    expect(payload.framework).toBe('js');
  });

  it('handles non-Error inputs', () => {
    const payload = buildExceptionPayload('plain string error', 'unhandled');

    expect(payload.exceptions).toBeDefined();
    expect(payload.exceptions.length).toBeGreaterThan(0);

    const exception = payload.exceptions[0];
    expect(exception).toBeDefined();
    expect(exception!.type).toBe('string');
    expect(exception!.frames).toEqual([]);
  });

  it('rewrites iOS release path to app:// format', () => {
    const err = new Error('crash');
    err.stack = `Error: crash
    at myFunc (/var/containers/Bundle/Application/UUID/AppName.app/main.jsbundle:1:12345)`;

    const payload = buildExceptionPayload(err, 'fatal');
    const frame = payload.exceptions[0]?.frames?.[0];

    expect(frame?.file_name).toBe('app:///main.jsbundle');
  });

  it('rewrites Android release path to app:// format', () => {
    const err = new Error('crash');
    err.stack = `Error: crash
    at myFunc (index.android.bundle:1:12345)`;

    const payload = buildExceptionPayload(err, 'fatal');
    const frame = payload.exceptions[0]?.frames?.[0];

    expect(frame?.file_name).toBe('app:///index.android.bundle');
  });

  it('marks all frames as in_app', () => {
    const err = new Error('crash');
    err.stack = `Error: crash
    at nativeFunc ([native code]:1:1)`;

    const payload = buildExceptionPayload(err, 'fatal');
    const frame = payload.exceptions[0]?.frames?.[0];

    expect(frame?.in_app).toBe(true);
  });

  it('increments col_num by 1 for Hermes bytecode frames (line === 1)', () => {
    (global as any).HermesInternal = {};
    const err = new Error('crash');
    err.stack = `Error: crash
    at myFunc (index.android.bundle:1:999)`;

    const payload = buildExceptionPayload(err, 'fatal');
    const frame = payload.exceptions[0]?.frames?.[0];

    expect(frame?.col_num).toBe(1000);
    delete (global as any).HermesInternal;
  });
});
