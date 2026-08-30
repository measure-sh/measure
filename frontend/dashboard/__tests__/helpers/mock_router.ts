/**
 * A stateful stand-in for next/navigation, shared by the suites of the pages
 * that carry their filter state in the URL's query params.
 *
 * The mocked router applies each replace back into the mocked searchParams
 * and notifies subscribers, the way the real router re-renders the page with
 * the URL it just wrote. The page's queries read the URL, so without this
 * they would never see what the bar settled on.
 *
 * jest.mock calls are hoisted per file, so each suite still declares its own
 * jest.mock("next/navigation", ...) whose factory requires this module and
 * returns nextNavigationMock(); the module registry hands the factory and
 * the suite's imports the same instance.
 */
import { useSyncExternalStore } from "react";

const subscribers = new Set<() => void>();

const applyReplaceUrl = (url: string) => {
  mockRouter.searchParams = new URLSearchParams(url.split("?")[1] ?? "");
  subscribers.forEach((notify) => notify());
};

// With deferReplace set, a replace's URL is held for the test to apply
// later, the way the real router updates searchParams only on a later render.
const replaceMock = jest.fn((url: string, _options?: { scroll: boolean }) => {
  if (mockRouter.deferReplace) {
    mockRouter.deferredReplaceUrl = url;
    return;
  }
  applyReplaceUrl(url);
});

export const mockRouter = {
  searchParams: new URLSearchParams(),
  deferReplace: false,
  deferredReplaceUrl: null as string | null,
  replaceMock,
  pushMock: jest.fn(),
  applyReplaceUrl,
  reset() {
    mockRouter.searchParams = new URLSearchParams();
    mockRouter.deferReplace = false;
    mockRouter.deferredReplaceUrl = null;
    mockRouter.replaceMock.mockClear();
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
      replace: mockRouter.replaceMock,
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
