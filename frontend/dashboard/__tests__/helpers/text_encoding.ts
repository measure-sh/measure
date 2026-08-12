/**
 * `jest-environment-jsdom` leaves TextEncoder undefined, so code that measures
 * a string in bytes throws under test while working in every browser. Node's
 * implementation stands in for it.
 *
 * Runs through `setupFilesAfterEnv` rather than `setupFiles`, because the
 * latter runs before jsdom installs its own globals and would be overwritten.
 */

Object.defineProperty(globalThis, "TextEncoder", {
  value: require("node:util").TextEncoder,
  writable: true,
  configurable: true,
});
