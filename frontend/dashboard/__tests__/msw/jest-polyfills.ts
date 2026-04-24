/**
 * Polyfills for MSW v2 in jsdom. The `jest-environment-jsdom` replaces
 * Node's Fetch API globals with undefined. We must restore them before
 * MSW's module code executes.
 *
 * Uses inline require() + Object.defineProperties to avoid declaring
 * local names that conflict with lib.dom.d.ts globals (TS6200).
 *
 * See: https://mswjs.io/docs/integrations/node#jest
 */

// These must be set BEFORE requiring undici (which needs TextEncoder)
Object.defineProperties(globalThis, {
    TextDecoder: { value: require('node:util').TextDecoder, writable: true, configurable: true },
    TextEncoder: { value: require('node:util').TextEncoder, writable: true, configurable: true },
    ReadableStream: { value: require('node:stream/web').ReadableStream, writable: true, configurable: true },
    TransformStream: { value: require('node:stream/web').TransformStream, writable: true, configurable: true },
    WritableStream: { value: require('node:stream/web').WritableStream, writable: true, configurable: true },
    BroadcastChannel: { value: require('node:worker_threads').BroadcastChannel, writable: true, configurable: true },
})

// Now safe to require undici for Fetch API globals
const undici = require('undici')
Object.defineProperties(globalThis, {
    fetch: { value: undici.fetch, writable: true, configurable: true },
    Headers: { value: undici.Headers, writable: true, configurable: true },
    Request: { value: undici.Request, writable: true, configurable: true },
    Response: { value: undici.Response, writable: true, configurable: true },
})
