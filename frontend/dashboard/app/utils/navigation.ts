/**
 * Full-page navigation and reload. App code calls these instead of
 * window.location so tests have a seam to mock: jsdom marks every member
 * of Location unforgeable, which makes the global impossible to stub in
 * a test environment.
 */

/** Navigate the browser to a URL with a full page load. */
export function navigateTo(url: string | URL): void {
  window.location.assign(url);
}

/** Reload the current page. */
export function reloadPage(): void {
  window.location.reload();
}
