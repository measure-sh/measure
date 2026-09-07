/**
 * Stand-in for next/navigation. `history.replaceState` is patched like the
 * app router's: jsdom updates `window.location` at once, then searchParams
 * update and subscribers are notified, or not until `applyDeferredReplace`
 * when `deferReplace` is set. A state already carrying `__NA` is passed
 * through without notifying, as the router does with its own writes.
 *
 * Each suite declares its own jest.mock("next/navigation") whose factory
 * returns nextNavigationMock(), since jest.mock calls are hoisted per file.
 */
import { useSyncExternalStore } from "react";

const subscribers = new Set<() => void>();

const jsdomReplaceState = window.history.replaceState.bind(window.history);

const readSearchParams = () => {
  mockRouter.searchParams = new URLSearchParams(window.location.search);
  subscribers.forEach((notify) => notify());
};

window.history.replaceState = (
  state: unknown,
  unused: string,
  url?: string | URL | null,
) => {
  if ((state as { __NA?: boolean } | null)?.__NA) {
    jsdomReplaceState(state, unused, url);
    return;
  }
  jsdomReplaceState({ ...(state ?? {}), __NA: true }, unused, url);
  if (mockRouter.deferReplace) {
    mockRouter.replaceDeferred = true;
    return;
  }
  readSearchParams();
};

export const mockRouter = {
  searchParams: new URLSearchParams(window.location.search),
  deferReplace: false,
  replaceDeferred: false,
  pushMock: jest.fn(),
  setUrl(search: string) {
    window.history.replaceState(
      null,
      "",
      search.startsWith("?") ? search : `?${search}`,
    );
  },
  urlParams() {
    return Object.fromEntries(new URLSearchParams(window.location.search));
  },
  applyDeferredReplace() {
    mockRouter.replaceDeferred = false;
    readSearchParams();
  },
  reset() {
    jsdomReplaceState(null, "", "/");
    mockRouter.searchParams = new URLSearchParams();
    mockRouter.deferReplace = false;
    mockRouter.replaceDeferred = false;
    mockRouter.pushMock.mockClear();
  },
};

/**
 * The next/navigation module shape for a suite's jest.mock factory. A suite
 * that stubs more of the module, such as usePathname, spreads this and adds
 * its own entries.
 */
export function nextNavigationMock() {
  return {
    __esModule: true,
    useRouter: () => ({
      push: mockRouter.pushMock,
    }),
    useSearchParams: () =>
      useSyncExternalStore(
        (notify: () => void) => {
          subscribers.add(notify);
          return () => subscribers.delete(notify);
        },
        () => mockRouter.searchParams,
      ),
  };
}
