import SignupConsentSaver, {
  signupConsentKey,
} from "@/app/components/signup_consent_saver";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { render } from "@testing-library/react";

let mockPrefs: any = undefined;
let mockQueryEnabled: boolean | undefined = undefined;
const mockMutate = jest.fn();

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  // Like React Query, a disabled query still returns data another component
  // loaded under the same key.
  useMailingListPrefsQuery: (enabled: boolean) => {
    mockQueryEnabled = enabled;
    return { data: mockPrefs };
  },
  useSaveMailingListPrefsMutation: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

describe("SignupConsentSaver", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrefs = {
      enabled: true,
      lists: [
        {
          list_id: "newsletter",
          name: "Measure newsletter",
          subscribed: false,
        },
      ],
    };
    mockQueryEnabled = undefined;
    window.sessionStorage.clear();
  });

  it("saves consent given at signup and clears it", () => {
    window.sessionStorage.setItem(signupConsentKey, "1");
    mockMutate.mockImplementation((_params: any, opts: any) =>
      opts.onSettled(),
    );

    const { container } = render(<SignupConsentSaver teamId="team-1" />);

    expect(container).toBeEmptyDOMElement();
    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate).toHaveBeenCalledWith(
      { listId: "newsletter", subscribed: true, attribution: "signup" },
      expect.anything(),
    );
    expect(window.sessionStorage.getItem(signupConsentKey)).toBeNull();
  });

  it("does not fetch prefs without consent from signup", () => {
    render(<SignupConsentSaver teamId="team-1" />);

    expect(mockQueryEnabled).toBe(false);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("does not subscribe a user who unsubscribed when Settings loads their prefs", () => {
    mockPrefs = {
      enabled: true,
      lists: [
        {
          list_id: "newsletter",
          name: "Measure newsletter",
          subscribed: false,
        },
      ],
    };

    render(<SignupConsentSaver teamId="team-1" />);

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("does not save for a user already subscribed", () => {
    window.sessionStorage.setItem(signupConsentKey, "1");
    mockPrefs = {
      enabled: true,
      lists: [
        { list_id: "newsletter", name: "Measure newsletter", subscribed: true },
      ],
    };

    render(<SignupConsentSaver teamId="team-1" />);

    expect(mockMutate).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(signupConsentKey)).toBeNull();
  });

  it("does nothing when the mailing list is not enabled", () => {
    window.sessionStorage.setItem(signupConsentKey, "1");
    mockPrefs = {
      enabled: false,
      lists: [
        {
          list_id: "newsletter",
          name: "Measure newsletter",
          subscribed: false,
        },
      ],
    };

    render(<SignupConsentSaver teamId="team-1" />);

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("does not fetch prefs for the sandbox team", () => {
    window.sessionStorage.setItem(signupConsentKey, "1");
    render(<SignupConsentSaver teamId="sandbox" />);
    expect(mockQueryEnabled).toBe(false);
  });
});
