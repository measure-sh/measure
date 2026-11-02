const { TestEnvironment } = require("jest-environment-jsdom");

// MSW answers requests at the socket level, so every fetch in the integration
// suite runs a real network path, and that path only works with Node's own
// timers and performance APIs. The suite gets Node's built-in fetch classes,
// the AbortController whose signals Node's Request accepts, and the
// setImmediate that MSW schedules socket work with, all of which the jsdom
// environment replaces or leaves out.
class JsdomNativeFetchEnvironment extends TestEnvironment {
  constructor(config, context) {
    super(config, context);
    for (const name of [
      "fetch",
      "Request",
      "Response",
      "Headers",
      "AbortController",
      "AbortSignal",
      "setImmediate",
      "clearImmediate",
    ]) {
      this.global[name] = globalThis[name];
    }
  }
}

module.exports = JsdomNativeFetchEnvironment;
