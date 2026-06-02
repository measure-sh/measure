/**
 * Wraps a value in a promise that React's `use()` can read synchronously.
 *
 * Next 16 made `params`/`searchParams` page props Promises, so pages now call
 * `use(props.params)`. In tests we render those pages directly, and `use()` on a
 * plain `Promise.resolve(...)` would suspend on first render — breaking the many
 * tests that assert synchronously right after `render()`. Tagging the promise as
 * already `fulfilled` (the same shape Next hands to client components) lets
 * `use()` read the value synchronously without suspending.
 */
export function promiseParams<T>(value: T): Promise<T> {
  const promise = Promise.resolve(value) as Promise<T> & {
    status: "fulfilled";
    value: T;
  };
  promise.status = "fulfilled";
  promise.value = value;
  return promise;
}
