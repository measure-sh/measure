/**
 * Integration tests for Team page.
 *
 * These cover the wiring between the page and the API: request paths and
 * payloads, cache updates after mutations, and how server errors surface in
 * the UI. Pure rendering and permission-gating behavior is covered by the
 * unit tests in __tests__/pages/team_test.tsx.
 */
import { promiseParams } from "@/__tests__/helpers/promise_params";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";

// --- jsdom polyfills ---
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
}

// --- External dependency mocks ---

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: { reset: jest.fn(), capture: jest.fn(), init: jest.fn() },
}));

// The page reload after a team rename goes through the navigation module
// because jsdom's window.location can't be stubbed; mock it so the reload
// is observable and a no-op in tests.
const mockReload = jest.fn();
jest.mock("@/app/utils/navigation", () => ({
  navigateTo: jest.fn(),
  reloadPage: (...args: any[]) => mockReload(...args),
}));

const mockRouterReplace = jest.fn();
const mockRouterPush = jest.fn();
const mockSearchParams = new URLSearchParams();
jest.mock("next/navigation", () => ({
  __esModule: true,
  useRouter: () => ({ replace: mockRouterReplace, push: mockRouterPush }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/team-001/team",
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock("next-themes", () => ({
  __esModule: true,
  useTheme: () => ({ theme: "light" }),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

// --- MSW ---
import {
  makeAuthzAndMembersFixture,
  makePendingInvitesFixture,
  makeSlackStatusFixture,
} from "../msw/fixtures";
import { server } from "../msw/server";

jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => {
  server.resetHandlers();
  mockRouterReplace.mockClear();
  mockRouterPush.mockClear();
});
afterAll(() => server.close());

// --- Store/component imports ---
import TeamOverview from "@/app/[teamId]/team/page";
import { Team } from "@/app/api/api_calls";
import { Toaster } from "@/app/components/toast";
import { useCreateTeamMutation } from "@/app/query/hooks";
import { queryClient } from "@/app/query/query_client";
import { QueryClientProvider } from "@tanstack/react-query";

beforeEach(() => {
  queryClient.clear();
  for (const key of [...mockSearchParams.keys()]) mockSearchParams.delete(key);
  const { apiClient } = require("@/app/api/api_client");
  apiClient.init({ replace: jest.fn(), push: jest.fn() });

  // Pre-populate the session cache so useSessionQuery resolves without
  // hitting /auth/session.
  queryClient.setQueryData(["session"], {
    user: { id: "user-current", email: "current@example.com" } as any,
  });
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

// ====================================================================
// TEAM PAGE
// ====================================================================
describe("Team Page (MSW integration)", () => {
  async function renderAndWaitForData() {
    renderWithProviders(
      <TeamOverview params={promiseParams({ teamId: "team-001" })} />,
    );
    // Wait for something that only appears after teams + authz data loads
    await waitFor(
      () => {
        expect(screen.getByText("Invite Team Members")).toBeTruthy();
      },
      { timeout: 10000 },
    );
  }

  // ================================================================
  // API PATHS
  // ================================================================
  describe("API paths", () => {
    it("fetches authz from /teams/:teamId/authz", async () => {
      const paths: string[] = [];
      server.use(
        http.get("*/api/teams/:teamId/authz", ({ request }) => {
          paths.push(new URL(request.url).pathname);
          return HttpResponse.json(makeAuthzAndMembersFixture());
        }),
      );
      await renderAndWaitForData();
      expect(paths.some((p) => p.includes("/authz"))).toBe(true);
    });

    it("fetches invites from /teams/:teamId/invites", async () => {
      const paths: string[] = [];
      server.use(
        http.get("*/api/teams/:teamId/invites", ({ request }) => {
          paths.push(new URL(request.url).pathname);
          return HttpResponse.json(makePendingInvitesFixture());
        }),
      );

      renderWithProviders(
        <TeamOverview params={promiseParams({ teamId: "team-001" })} />,
      );
      await waitFor(
        () => {
          expect(paths.some((p) => p.includes("/invites"))).toBe(true);
        },
        { timeout: 5000 },
      );
    });
  });
});

// ====================================================================
// MUTATIONS
// ====================================================================
describe("Team Page — mutations", () => {
  async function renderAndWaitForData() {
    renderWithProviders(
      <TeamOverview params={promiseParams({ teamId: "team-001" })} />,
    );
    await waitFor(
      () => {
        expect(screen.getByText("Invite Team Members")).toBeTruthy();
      },
      { timeout: 10000 },
    );
  }

  // ================================================================
  // RENAME TEAM
  // ================================================================
  describe("rename team", () => {
    it("calls PATCH /teams/:teamId/rename with new name after confirmation", async () => {
      let capturedBody: any = null;
      server.use(
        http.patch("*/api/teams/:teamId/rename", async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({ ok: true });
        }),
      );

      // The component reloads the page on success through the mocked
      // navigation module.
      mockReload.mockClear();

      await renderAndWaitForData();

      const input = document.getElementById(
        "change-team-name-input",
      ) as HTMLInputElement;
      expect(input).toBeTruthy();

      // Type new name
      await act(async () => {
        fireEvent.change(input, { target: { value: "New Team Name" } });
      });

      // Click Save (near Change Team Name section)
      const saveButtons = screen.getAllByText("Save");
      const teamNameSaveBtn =
        saveButtons[saveButtons.length - 1].closest("button")!;
      expect(teamNameSaveBtn.disabled).toBe(false);

      await act(async () => {
        fireEvent.click(teamNameSaveBtn);
      });

      // Confirm the dialog
      await waitFor(() => {
        expect(screen.getByText("Yes, I'm sure")).toBeTruthy();
      });
      await act(async () => {
        fireEvent.click(screen.getByText("Yes, I'm sure"));
      });

      // Verify API was called with correct payload
      await waitFor(
        () => {
          expect(capturedBody).toEqual({ name: "New Team Name" });
        },
        { timeout: 5000 },
      );
    });
  });

  // ================================================================
  // INVITE MEMBER
  // ================================================================
  describe("invite member", () => {
    it("calls POST /teams/:teamId/invite with email and role, then refreshes invites list", async () => {
      let capturedBody: any = null;
      let inviteSent = false;
      server.use(
        http.post("*/api/teams/:teamId/invite", async ({ request }) => {
          capturedBody = await request.json();
          inviteSent = true;
          return HttpResponse.json({ ok: true });
        }),
        http.get("*/api/teams/:teamId/invites", () => {
          if (inviteSent) {
            return HttpResponse.json([
              ...makePendingInvitesFixture(),
              {
                id: "invite-002",
                invited_by_user_id: "user-current",
                invited_by_email: "current@example.com",
                invited_to_team_id: "team-001",
                role: "owner",
                email: "newinvite@example.com",
                created_at: "2026-04-16T00:00:00Z",
                updated_at: "2026-04-16T00:00:00Z",
                valid_until: "2026-04-23T00:00:00Z",
              },
            ]);
          }
          return HttpResponse.json(makePendingInvitesFixture());
        }),
      );

      await renderAndWaitForData();

      // Type email in invite input
      const emailInput = screen.getByPlaceholderText("Enter email");
      await act(async () => {
        fireEvent.input(emailInput, {
          target: { value: "newinvite@example.com" },
        });
      });

      // Click Invite button
      const inviteBtn = screen.getByText("Invite").closest("button")!;
      expect(inviteBtn.disabled).toBe(false);

      await act(async () => {
        fireEvent.click(inviteBtn);
      });

      // Verify API was called with correct payload
      await waitFor(
        () => {
          expect(capturedBody).toEqual([
            { email: "newinvite@example.com", role: "owner" },
          ]);
        },
        { timeout: 5000 },
      );

      // Verify new invite appears in the list after refetch
      await waitFor(
        () => {
          expect(screen.getByText("newinvite@example.com")).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });
  });

  // ================================================================
  // REMOVE MEMBER
  // ================================================================
  describe("remove member mutation", () => {
    it("calls DELETE /teams/:teamId/members/:memberId and removes member from list", async () => {
      let deleteCalled = false;
      let deletePath = "";
      server.use(
        http.delete("*/api/teams/:teamId/members/:memberId", ({ request }) => {
          deleteCalled = true;
          deletePath = new URL(request.url).pathname;
          return HttpResponse.json({ ok: true });
        }),
        http.get("*/api/teams/:teamId/authz", () => {
          if (deleteCalled) {
            // Return only the current user after removal
            return HttpResponse.json(
              makeAuthzAndMembersFixture({
                members: [makeAuthzAndMembersFixture().members[0]],
              }),
            );
          }
          return HttpResponse.json(makeAuthzAndMembersFixture());
        }),
      );

      await renderAndWaitForData();

      // Verify member@example.com is present
      expect(screen.getByText("member@example.com")).toBeTruthy();

      // Click Remove
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Remove" }));
      });

      // Confirm the dialog
      await waitFor(() => {
        expect(screen.getByText("Yes, I'm sure")).toBeTruthy();
      });
      await act(async () => {
        fireEvent.click(screen.getByText("Yes, I'm sure"));
      });

      // Verify API was called
      await waitFor(
        () => {
          expect(deleteCalled).toBe(true);
          expect(deletePath).toContain("/members/user-member");
        },
        { timeout: 5000 },
      );

      // Verify member is removed from the list after refetch
      await waitFor(
        () => {
          expect(screen.queryByText("member@example.com")).toBeNull();
        },
        { timeout: 5000 },
      );
    });
  });

  // ================================================================
  // CHANGE ROLE
  // ================================================================
  describe("change role mutation", () => {
    it("calls PATCH /teams/:teamId/members/:memberId/role after confirmation", async () => {
      let capturedBody: any = null;
      let rolePath = "";
      server.use(
        http.patch(
          "*/api/teams/:teamId/members/:memberId/role",
          async ({ request }) => {
            capturedBody = await request.json();
            rolePath = new URL(request.url).pathname;
            return HttpResponse.json({ ok: true });
          },
        ),
      );

      await renderAndWaitForData();

      // The non-current member holds role "admin" with assignable roles
      // ["admin", "viewer"]; the row's role dropdown trigger shows "Admin".
      const roleDropdownTrigger = screen.getByText("Admin").closest("button")!;
      expect(roleDropdownTrigger).toBeTruthy();
      await act(async () => {
        fireEvent.click(roleDropdownTrigger);
      });

      // Pick "Viewer" from the dropdown. "Viewer" also appears in the pending
      // invites table, so match only the text inside a dropdown option.
      const viewerOption = await waitFor(() => {
        const option = screen
          .getAllByText("Viewer")
          .find((el) => el.closest('[role="option"]'));
        expect(option).toBeTruthy();
        return option!;
      });
      await act(async () => {
        fireEvent.click(viewerOption);
      });

      // Selecting a role different from the current one enables Change Role.
      const changeRoleBtn = screen.getByText("Change Role").closest("button")!;
      await waitFor(() => {
        expect(changeRoleBtn.disabled).toBe(false);
      });

      await act(async () => {
        fireEvent.click(changeRoleBtn);
      });

      // Confirm the dialog
      await waitFor(() => {
        expect(screen.getByText("Yes, I'm sure")).toBeTruthy();
      });
      await act(async () => {
        fireEvent.click(screen.getByText("Yes, I'm sure"));
      });

      // Verify API was called with the lowercased role and the member's path
      await waitFor(
        () => {
          expect(capturedBody).toEqual({ role: "viewer" });
          expect(rolePath).toContain("/members/user-member/role");
        },
        { timeout: 5000 },
      );
    });
  });

  // ================================================================
  // REVOKE PENDING INVITE
  // ================================================================
  describe("revoke pending invite", () => {
    it("calls DELETE /teams/:teamId/invite/:inviteId and removes invite from list", async () => {
      let deleteCalled = false;
      let deletePath = "";
      server.use(
        http.delete("*/api/teams/:teamId/invite/:inviteId", ({ request }) => {
          deleteCalled = true;
          deletePath = new URL(request.url).pathname;
          return HttpResponse.json({ ok: true });
        }),
        http.get("*/api/teams/:teamId/invites", () => {
          if (deleteCalled) {
            return HttpResponse.json([]);
          }
          return HttpResponse.json(makePendingInvitesFixture());
        }),
      );

      await renderAndWaitForData();

      // Verify pending invite is present
      expect(screen.getByText("pending@example.com")).toBeTruthy();

      // Click Revoke
      await act(async () => {
        fireEvent.click(screen.getByText("Revoke"));
      });

      // Confirm the dialog
      await waitFor(() => {
        expect(screen.getByText("Yes, I'm sure")).toBeTruthy();
      });
      await act(async () => {
        fireEvent.click(screen.getByText("Yes, I'm sure"));
      });

      // Verify API was called with correct path
      await waitFor(
        () => {
          expect(deleteCalled).toBe(true);
          expect(deletePath).toContain("/invite/invite-001");
        },
        { timeout: 5000 },
      );

      // Verify invite is removed from the list after refetch
      await waitFor(
        () => {
          expect(screen.queryByText("pending@example.com")).toBeNull();
        },
        { timeout: 5000 },
      );
    });
  });

  // ================================================================
  // RESEND PENDING INVITE
  // ================================================================
  describe("resend pending invite", () => {
    it("calls PATCH /teams/:teamId/invite/:inviteId after confirmation", async () => {
      let patchCalled = false;
      let patchPath = "";
      server.use(
        http.patch("*/api/teams/:teamId/invite/:inviteId", ({ request }) => {
          patchCalled = true;
          patchPath = new URL(request.url).pathname;
          return HttpResponse.json({ ok: true });
        }),
      );

      await renderAndWaitForData();

      // Verify pending invite is present
      expect(screen.getByText("pending@example.com")).toBeTruthy();

      // Click Resend
      await act(async () => {
        fireEvent.click(screen.getByText("Resend"));
      });

      // Confirm the dialog
      await waitFor(() => {
        expect(screen.getByText("Yes, I'm sure")).toBeTruthy();
      });
      await act(async () => {
        fireEvent.click(screen.getByText("Yes, I'm sure"));
      });

      // Verify API was called with correct path
      await waitFor(
        () => {
          expect(patchCalled).toBe(true);
          expect(patchPath).toContain("/invite/invite-001");
        },
        { timeout: 5000 },
      );
    });
  });

  // ================================================================
  // SEND TEST SLACK ALERT
  // ================================================================
  describe("send test Slack alert", () => {
    it("calls POST /teams/:teamId/slack/test after confirmation", async () => {
      let postCalled = false;
      let postPath = "";
      server.use(
        http.post("*/api/teams/:teamId/slack/test", ({ request }) => {
          postCalled = true;
          postPath = new URL(request.url).pathname;
          return HttpResponse.json({ ok: true });
        }),
      );

      await renderAndWaitForData();

      // Wait for Slack section to load
      await waitFor(
        () => {
          expect(screen.getByText("Send Test Alert")).toBeTruthy();
        },
        { timeout: 5000 },
      );

      // Click Send Test Alert
      await act(async () => {
        fireEvent.click(screen.getByText("Send Test Alert"));
      });

      // Confirm the dialog
      await waitFor(() => {
        expect(screen.getByText("Yes, I'm sure")).toBeTruthy();
      });
      await act(async () => {
        fireEvent.click(screen.getByText("Yes, I'm sure"));
      });

      // Verify API was called
      await waitFor(
        () => {
          expect(postCalled).toBe(true);
          expect(postPath).toContain("/slack/test");
        },
        { timeout: 5000 },
      );
    });

    it("shows the server error message in the toast when the API fails", async () => {
      const serverError =
        "No registered alert channels found for Workspace Acme. Please add Measure app to a channel and use /subscribe-alerts";
      server.use(
        http.post("*/api/teams/:teamId/slack/test", () => {
          return HttpResponse.json({ error: serverError }, { status: 500 });
        }),
      );

      renderWithProviders(
        <>
          <TeamOverview params={promiseParams({ teamId: "team-001" })} />
          <Toaster />
        </>,
      );
      await waitFor(
        () => {
          expect(screen.getByText("Send Test Alert")).toBeTruthy();
        },
        { timeout: 5000 },
      );

      await act(async () => {
        fireEvent.click(screen.getByText("Send Test Alert"));
      });

      await waitFor(() => {
        expect(screen.getByText("Yes, I'm sure")).toBeTruthy();
      });
      await act(async () => {
        fireEvent.click(screen.getByText("Yes, I'm sure"));
      });

      await waitFor(
        () => {
          expect(screen.getByText(serverError)).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });
  });

  describe("remove Slack connection", () => {
    it("calls DELETE /teams/:teamId/slack after confirmation and returns to the connect state", async () => {
      let deleteCalled = false;
      let deletePath = "";
      server.use(
        // once the delete lands, the status refetch reports no connection
        http.get("*/api/teams/:teamId/slack", () => {
          return deleteCalled
            ? HttpResponse.json(null)
            : HttpResponse.json(makeSlackStatusFixture());
        }),
        http.delete("*/api/teams/:teamId/slack", ({ request }) => {
          deleteCalled = true;
          deletePath = new URL(request.url).pathname;
          return HttpResponse.json({ ok: "done" });
        }),
      );

      await renderAndWaitForData();

      await waitFor(
        () => {
          expect(
            screen.getByRole("button", { name: "Remove Slack connection" }),
          ).toBeTruthy();
        },
        { timeout: 5000 },
      );

      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: "Remove Slack connection" }),
        );
      });

      // the dialog explains the deletion and that the app stays installed
      // in the workspace
      await waitFor(() => {
        expect(
          screen.getByText(/will delete your Slack connection/),
        ).toBeTruthy();
        expect(screen.getByText(/remain in your workspace/)).toBeTruthy();
        expect(screen.getByText("Yes, I'm sure")).toBeTruthy();
      });
      await act(async () => {
        fireEvent.click(screen.getByText("Yes, I'm sure"));
      });

      await waitFor(
        () => {
          expect(deleteCalled).toBe(true);
          expect(deletePath).toBe("/api/teams/team-001/slack");
        },
        { timeout: 5000 },
      );

      // the status query invalidation refetches and the connect button returns
      await waitFor(
        () => {
          expect(screen.getByAltText("Add to Slack")).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });

    it("already-removed integration resolves to the connect state, not an error", async () => {
      // another session removed the integration: DELETE 404s and the status
      // refetch reports no connection
      let deleteCalled = false;
      server.use(
        http.get("*/api/teams/:teamId/slack", () => {
          return deleteCalled
            ? HttpResponse.json(null)
            : HttpResponse.json(makeSlackStatusFixture());
        }),
        http.delete("*/api/teams/:teamId/slack", () => {
          deleteCalled = true;
          return HttpResponse.json(
            { error: "no slack integration found for the team" },
            { status: 404 },
          );
        }),
      );

      await renderAndWaitForData();

      await waitFor(
        () => {
          expect(
            screen.getByRole("button", { name: "Remove Slack connection" }),
          ).toBeTruthy();
        },
        { timeout: 5000 },
      );

      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: "Remove Slack connection" }),
        );
      });
      await waitFor(() => {
        expect(screen.getByText("Yes, I'm sure")).toBeTruthy();
      });
      await act(async () => {
        fireEvent.click(screen.getByText("Yes, I'm sure"));
      });

      // 404 counts as removed: the section flips to the connect state
      await waitFor(
        () => {
          expect(screen.getByAltText("Add to Slack")).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });
  });

  // ================================================================
  // MUTATION ERROR HANDLING
  // ================================================================
  describe("mutation error handling", () => {
    it("rename team API returns 500 — team name not changed in UI", async () => {
      server.use(
        http.patch("*/api/teams/:teamId/rename", () => {
          return HttpResponse.json({ error: "server error" }, { status: 500 });
        }),
      );

      // The component only reloads on success, so the mocked navigation
      // module must stay untouched here.
      const reloadMock = mockReload;
      reloadMock.mockClear();

      await renderAndWaitForData();

      const input = document.getElementById(
        "change-team-name-input",
      ) as HTMLInputElement;
      expect(input.value).toBe("Test Team");

      // Type new name
      await act(async () => {
        fireEvent.change(input, { target: { value: "Failed Name" } });
      });

      // Click Save
      const saveButtons = screen.getAllByText("Save");
      const teamNameSaveBtn =
        saveButtons[saveButtons.length - 1].closest("button")!;
      await act(async () => {
        fireEvent.click(teamNameSaveBtn);
      });

      // Confirm dialog
      await waitFor(() => {
        expect(screen.getByText("Yes, I'm sure")).toBeTruthy();
      });
      await act(async () => {
        fireEvent.click(screen.getByText("Yes, I'm sure"));
      });

      // Wait for error to be processed
      await waitFor(
        () => {
          // reload should NOT have been called (only called on success)
          expect(reloadMock).not.toHaveBeenCalled();
        },
        { timeout: 5000 },
      );
    });

    it("remove member API returns 500 — member still in list", async () => {
      server.use(
        http.delete("*/api/teams/:teamId/members/:memberId", () => {
          return HttpResponse.json({ error: "server error" }, { status: 500 });
        }),
      );

      await renderAndWaitForData();

      // Verify member is present
      expect(screen.getByText("member@example.com")).toBeTruthy();

      // Click Remove
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Remove" }));
      });

      // Confirm dialog
      await waitFor(() => {
        expect(screen.getByText("Yes, I'm sure")).toBeTruthy();
      });
      await act(async () => {
        fireEvent.click(screen.getByText("Yes, I'm sure"));
      });

      // Wait for error to be processed, then verify member is still present
      await waitFor(
        () => {
          expect(screen.getByText("member@example.com")).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });
  });

  // ================================================================
  // TOGGLE SLACK STATUS
  // ================================================================
  describe("toggle Slack status", () => {
    it("calls PATCH /teams/:teamId/slack/status to disable and updates UI", async () => {
      let capturedBody: any = null;
      let slackDisabled = false;
      server.use(
        http.patch("*/api/teams/:teamId/slack/status", async ({ request }) => {
          capturedBody = await request.json();
          slackDisabled = true;
          return HttpResponse.json({ ok: true });
        }),
        http.get("*/api/teams/:teamId/slack", () => {
          if (slackDisabled) {
            return HttpResponse.json(
              makeSlackStatusFixture({ is_active: false }),
            );
          }
          return HttpResponse.json(makeSlackStatusFixture());
        }),
      );

      await renderAndWaitForData();

      // Wait for Slack section to load
      await waitFor(
        () => {
          expect(screen.getByText("Send Test Alert")).toBeTruthy();
        },
        { timeout: 5000 },
      );

      // Find the Switch toggle - it renders as a button with role="switch"
      const switchEl = document.querySelector(
        '[data-slot="switch"]',
      ) as HTMLButtonElement;
      expect(switchEl).toBeTruthy();

      // Click the switch to disable (it's currently active)
      await act(async () => {
        fireEvent.click(switchEl);
      });

      // A confirmation dialog should appear for disabling
      await waitFor(() => {
        expect(screen.getByText("Yes, I'm sure")).toBeTruthy();
      });

      // Confirm disable
      await act(async () => {
        fireEvent.click(screen.getByText("Yes, I'm sure"));
      });

      // Verify API was called with correct payload
      await waitFor(
        () => {
          expect(capturedBody).toEqual({ is_active: false });
        },
        { timeout: 5000 },
      );

      // Verify Send Test Alert becomes disabled after refetch
      await waitFor(
        () => {
          expect(
            screen.getByText("Send Test Alert").closest("button")?.disabled,
          ).toBe(true);
        },
        { timeout: 5000 },
      );
    });
  });
});

// ====================================================================
// CREATE TEAM DIALOG
// ====================================================================
describe("Team Page — create team dialog", () => {
  async function renderAndWaitForData() {
    renderWithProviders(
      <TeamOverview params={promiseParams({ teamId: "team-001" })} />,
    );
    await waitFor(
      () => {
        expect(screen.getByText("Invite Team Members")).toBeTruthy();
      },
      { timeout: 10000 },
    );
  }

  it("submitting creates team and calls router.push", async () => {
    let capturedBody: any = null;
    server.use(
      http.post("*/api/teams", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: "team-new", name: "My New Team" });
      }),
    );

    await renderAndWaitForData();

    // Open dialog
    const createTeamBtn = screen.getByText("Create Team").closest("button")!;
    await act(async () => {
      fireEvent.click(createTeamBtn);
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter team name")).toBeTruthy();
    });

    // Type team name
    const input = screen.getByPlaceholderText("Enter team name");
    await act(async () => {
      fireEvent.change(input, { target: { value: "My New Team" } });
    });

    // Click submit
    const allCreateTeamButtons = screen.getAllByText("Create Team");
    const dialogSubmitBtn = allCreateTeamButtons
      .map((el) => el.closest("button"))
      .find((btn) => btn && btn.getAttribute("type") === "submit");

    await act(async () => {
      fireEvent.click(dialogSubmitBtn!);
    });

    await waitFor(
      () => {
        expect(capturedBody).toEqual({ name: "My New Team" });
        expect(mockRouterPush).toHaveBeenCalledWith("/team-new/team");
      },
      { timeout: 5000 },
    );
  });
});

// ====================================================================
// CACHE HYDRATION CONTRACT (regression guard)
// ====================================================================
//
// After useCreateTeamMutation succeeds, the ["teams"] query cache must
// contain the new team synchronously inside onSuccess — not after an
// async refetch. That synchronous write is what lets the navigation
// fired by CreateTeam (router.push to the new team's page) find the
// team in the cache on mount instead of resolving to null, which
// crashes the team page on the eagerly-evaluated `team!.name`
// references in dialog bodies and the rename input's defaultValue.
//
// Tests below use renderHook so useTeamsQuery has no observers. With
// no observers, invalidateQueries does not trigger a background
// refetch, which would otherwise race the assertion and mask whether
// the synchronous cache write actually happened.
describe("useCreateTeamMutation — cache hydration contract", () => {
  // The global queryClient defaults to gcTime: 0 (no caching between page
  // navigations). Override for these tests so setQueryData entries survive
  // long enough for the assertion to read them back, since renderHook
  // doesn't add an observer for the ['teams'] key.
  let originalDefaults: any;
  beforeAll(() => {
    originalDefaults = queryClient.getDefaultOptions();
    queryClient.setDefaultOptions({
      ...originalDefaults,
      queries: { ...(originalDefaults.queries ?? {}), gcTime: Infinity },
    });
  });
  afterAll(() => {
    queryClient.setDefaultOptions(originalDefaults);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('appends the new team to the existing ["teams"] cache on success', async () => {
    server.use(
      http.post("*/api/teams", async ({ request }) => {
        const body = (await request.json()) as { name: string };
        return HttpResponse.json({ id: "team-new", name: body.name });
      }),
    );

    queryClient.setQueryData<Team[]>(
      ["teams"],
      [
        { id: "team-001", name: "Test Team" },
        { id: "team-002", name: "Other Team" },
      ],
    );

    const { result } = renderHook(() => useCreateTeamMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ teamName: "Brand New" });
    });

    expect(queryClient.getQueryData<Team[]>(["teams"])).toEqual([
      { id: "team-001", name: "Test Team" },
      { id: "team-002", name: "Other Team" },
      { id: "team-new", name: "Brand New" },
    ]);
  });

  it('initializes the ["teams"] cache when no prior teams data exists', async () => {
    server.use(
      http.post("*/api/teams", async ({ request }) => {
        const body = (await request.json()) as { name: string };
        return HttpResponse.json({ id: "team-new", name: body.name });
      }),
    );

    expect(queryClient.getQueryData<Team[]>(["teams"])).toBeUndefined();

    const { result } = renderHook(() => useCreateTeamMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ teamName: "Solo" });
    });

    expect(queryClient.getQueryData<Team[]>(["teams"])).toEqual([
      { id: "team-new", name: "Solo" },
    ]);
  });

  it("leaves the cache untouched when the mutation errors", async () => {
    server.use(
      http.post("*/api/teams", () => {
        return HttpResponse.json({ error: "duplicate" }, { status: 409 });
      }),
    );

    const seed: Team[] = [
      { id: "team-001", name: "Test Team" },
      { id: "team-002", name: "Other Team" },
    ];
    queryClient.setQueryData<Team[]>(["teams"], seed);

    const { result } = renderHook(() => useCreateTeamMutation(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ teamName: "Boom" }),
      ).rejects.toThrow();
    });

    expect(queryClient.getQueryData<Team[]>(["teams"])).toEqual(seed);
  });
});
