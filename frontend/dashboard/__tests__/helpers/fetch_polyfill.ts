// jest-environment-jsdom replaces Node's Fetch API globals with placeholders
// that throw on `new Response()` and `instanceof Request`, so the unit suite
// gets undici's Request, Response and Headers instead. It gets no fetch because
// its tests mock every call. The integration suite's test environment,
// jsdom_native_fetch_environment.js, supplies Node's own fetch classes.
Object.defineProperties(globalThis, {
  TextDecoder: {
    value: require("node:util").TextDecoder,
    writable: true,
    configurable: true,
  },
  TextEncoder: {
    value: require("node:util").TextEncoder,
    writable: true,
    configurable: true,
  },
  ReadableStream: {
    value: require("node:stream/web").ReadableStream,
    writable: true,
    configurable: true,
  },
  TransformStream: {
    value: require("node:stream/web").TransformStream,
    writable: true,
    configurable: true,
  },
  WritableStream: {
    value: require("node:stream/web").WritableStream,
    writable: true,
    configurable: true,
  },
  CompressionStream: {
    value: require("node:stream/web").CompressionStream,
    writable: true,
    configurable: true,
  },
  DecompressionStream: {
    value: require("node:stream/web").DecompressionStream,
    writable: true,
    configurable: true,
  },
  BroadcastChannel: {
    value: require("node:worker_threads").BroadcastChannel,
    writable: true,
    configurable: true,
  },
  MessagePort: {
    value: require("node:worker_threads").MessagePort,
    writable: true,
    configurable: true,
  },
});

if ((globalThis as any).__JEST_INTEGRATION__) {
  Object.defineProperties(globalThis, {
    ResizeObserver: {
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
      writable: true,
      configurable: true,
    },
  });
} else {
  const undici = require("undici");

  Object.defineProperties(globalThis, {
    Headers: { value: undici.Headers, writable: true, configurable: true },
    Request: { value: undici.Request, writable: true, configurable: true },
    Response: { value: undici.Response, writable: true, configurable: true },
  });
}

export {};
