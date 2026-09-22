// jest-environment-jsdom replaces Node's Fetch API globals with placeholders
// that throw on `new Response()` and `instanceof Request`, so undici's classes
// go in instead. A live fetch is installed only for the integration suite
// because the unit suite mocks fetch and an unmocked call there would reach
// the network.
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
  BroadcastChannel: {
    value: require("node:worker_threads").BroadcastChannel,
    writable: true,
    configurable: true,
  },
});

const undici = require("undici");

Object.defineProperties(globalThis, {
  Headers: { value: undici.Headers, writable: true, configurable: true },
  Request: { value: undici.Request, writable: true, configurable: true },
  Response: { value: undici.Response, writable: true, configurable: true },
});

if ((globalThis as any).__JEST_INTEGRATION__) {
  Object.defineProperties(globalThis, {
    fetch: { value: undici.fetch, writable: true, configurable: true },
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
}

export {};
