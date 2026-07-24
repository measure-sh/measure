"use client";
import {
  useAuthzAndMembersQuery,
  useChangeRoleMutation,
  useChangeTeamNameMutation,
  useInviteMemberMutation,
  usePendingInvitesQuery,
  useRemoveMemberMutation,
  useRemovePendingInviteMutation,
  useRemoveTeamSlackMutation,
  useResendPendingInviteMutation,
  useSessionQuery,
  useTeamSlackConnectUrlQuery,
  useTeamSlackStatusQuery,
  useTeamsQuery,
  useTestSlackAlertMutation,
  useUpdateSlackStatusMutation,
} from "@/app/query/hooks";

import { defaultAuthzAndMembers } from "@/app/api/api_calls";
import { Button } from "@/app/components/button";
import ConfirmationDialog from "@/app/components/confirmation_dialog";
import CreateTeam from "@/app/components/create_team";
import DangerConfirmationDialog from "@/app/components/danger_confirmation_dialog";
import DropdownSelect, {
  DropdownSelectType,
} from "@/app/components/dropdown_select";
import InfoTooltip from "@/app/components/info_tooltip";
import { Input } from "@/app/components/input";
import { Skeleton, SkeletonTable } from "@/app/components/skeleton";
import { Switch } from "@/app/components/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/table";
import { isCloud } from "@/app/utils/env_utils";
import {
  underlineLinkStyle,
  warningCalloutStyle,
} from "@/app/utils/shared_styles";
import { formatToCamelCase } from "@/app/utils/string_utils";
import { formatDateToHumanReadableDateTime } from "@/app/utils/time_utils";
import { toastNegative, toastPositive } from "@/app/utils/use_toast";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

export default function TeamOverview(props: {
  params: Promise<{ teamId: string }>;
}) {
  const params = use(props.params);
  const teamsQuery = useTeamsQuery();
  const team = teamsQuery.data?.find((t) => t.id === params.teamId) ?? null;

  // Get current user ID from session query
  const sessionQuery = useSessionQuery();
  const currentUserId = sessionQuery.data?.user?.id;

  // TanStack Query: reads
  const authzAndMembersQuery = useAuthzAndMembersQuery(params.teamId);
  const pendingInvitesQuery = usePendingInvitesQuery(params.teamId);

  const authz = authzAndMembersQuery.data ?? defaultAuthzAndMembers;
  const pendingInvites = pendingInvitesQuery.data;

  // The connect URL endpoint requires Slack management permission and returns
  // 403 for everyone else, so the query runs only for users who hold it.
  const slackConnectUrlQuery = useTeamSlackConnectUrlQuery(
    params.teamId,
    authz.can_manage_slack,
  );
  const slackStatusQuery = useTeamSlackStatusQuery(params.teamId);
  const teamSlackConnectUrl = slackConnectUrlQuery.data;
  const teamSlack = slackStatusQuery.data;

  // Type for member entries in authz response
  type AuthzMember = {
    id: string;
    email: string;
    role: string;
    name: string | null;
    last_sign_in_at: string;
    created_at: string;
    authz: {
      current_user_assignable_roles_for_member: string[] | null;
      current_user_can_remove_member: boolean;
    };
  };

  // What the Slack section shows. Every member may read the Slack status, so
  // the status query drives the section. The connect URL is fetched only for
  // users who can manage Slack (the endpoint returns 403 for everyone else)
  // and is waited on only where it becomes an href: the connect button.
  //
  // The check order matters: each check assumes the ones above it already
  // returned, which keeps the conditions free of repeated guards. The authz
  // check runs before the connected check so the connected controls never
  // render with the no-permission fallback and then flip once authz loads.
  // The connected check runs before the authz error check: a connected team
  // still renders read-only when authz fails, while the not-connected
  // branches need the permission to pick what to show, so there the failure
  // surfaces as authzError. The permission check runs before the connect URL
  // checks because a query disabled via `enabled` reports "pending" forever,
  // and checking the URL first would keep non-managers on the loading
  // skeleton.
  type SlackSectionState =
    | "loading"
    | "error"
    | "authzError"
    | "connected"
    | "canConnect"
    | "cannotConnect";
  const slackSection: SlackSectionState = (() => {
    if (slackStatusQuery.status === "pending") {
      return "loading";
    }
    if (slackStatusQuery.status === "error") {
      return "error";
    }
    if (authzAndMembersQuery.status === "pending") {
      return "loading";
    }
    if (teamSlack != null) {
      return "connected";
    }
    if (authzAndMembersQuery.status === "error") {
      return "authzError";
    }
    if (!authz.can_manage_slack) {
      return "cannotConnect";
    }
    if (slackConnectUrlQuery.status === "pending") {
      return "loading";
    }
    if (slackConnectUrlQuery.status === "error") {
      return "error";
    }
    return "canConnect";
  })();

  // A team that connected Slack before newer scopes were added keeps a token
  // frozen at the old scopes. Slack never prompts existing installs, so the
  // API detects the gap (needs_reauth) and the connected view shows a
  // reconnect banner. The banner appears only when it offers a real action:
  // the reconnect link for a user who can manage Slack, or a note to ask an
  // owner for everyone else. A manager without the connect URL, still loading
  // or failed, gets no banner rather than one with a dead action.
  type SlackReauthPrompt = "reconnectLink" | "askOwner" | null;
  const slackReauthPrompt: SlackReauthPrompt = (() => {
    if (slackSection !== "connected") {
      return null;
    }
    if (teamSlack.needs_reauth !== true) {
      return null;
    }
    if (!authz.can_manage_slack) {
      return "askOwner";
    }
    if (teamSlackConnectUrl) {
      return "reconnectLink";
    }
    return null;
  })();

  // TanStack Query: mutations
  const changeTeamNameMutation = useChangeTeamNameMutation();
  const inviteMemberMutation = useInviteMemberMutation();
  const removeMemberMutation = useRemoveMemberMutation();
  const resendPendingInviteMutation = useResendPendingInviteMutation();
  const removePendingInviteMutation = useRemovePendingInviteMutation();
  const changeRoleMutation = useChangeRoleMutation();
  const updateSlackStatusMutation = useUpdateSlackStatusMutation();
  const removeTeamSlackMutation = useRemoveTeamSlackMutation();
  const testSlackAlertMutation = useTestSlackAlertMutation();

  const [saveTeamNameButtonDisabled, setSaveTeamNameButtonDisabled] =
    useState(true);
  const [teamNameConfirmationDialogOpen, setTeamNameConfirmationDialogOpen] =
    useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [inviteMemberRole, setInviteMemberRole] = useState("Owner");
  const [inviteMemberEmail, setInviteMemberEmail] = useState("");
  const [
    removeMemberConfirmationDialogOpen,
    setRemoveMemberConfirmationDialogOpen,
  ] = useState(false);
  const [removeMemberId, setRemoveMemberId] = useState("");
  const [removeMemberEmail, setRemoveMemberEmail] = useState("");
  const [
    resendPendingInviteConfirmationDialogOpen,
    setResendPendingInviteConfirmationDialogOpen,
  ] = useState(false);
  const [resendPendingInviteId, setResendPendingInviteId] = useState("");
  const [resendPendingInviteEmail, setResendPendingInviteEmail] = useState("");
  const [
    removePendingInviteConfirmationDialogOpen,
    setRemovePendingInviteConfirmationDialogOpen,
  ] = useState(false);
  const [removePendingInviteId, setRemovePendingInviteId] = useState("");
  const [removePendingInviteEmail, setRemovePendingInviteEmail] = useState("");
  const [selectedDropdownRolesMap, setSelectedDropdownRolesMap] = useState<
    Map<String, String>
  >(new Map());
  const [
    changeRoleConfirmationDialogOpen,
    setChangeRoleConfirmationDialogOpen,
  ] = useState(false);
  const [roleChangeMemberId, setRoleChangeMemberId] = useState("");
  const [roleChangeMemberEmail, setRoleChangeMemberEmail] = useState("");
  const [roleChangeOldRole, setRoleChangeOldRole] = useState("");
  const [roleChangeNewRole, setRoleChangeNewRole] = useState("");
  const [
    disableSlackConfirmationDialogOpen,
    setDisableSlackConfirmationDialogOpen,
  ] = useState(false);
  const [
    removeSlackConfirmationDialogOpen,
    setRemoveSlackConfirmationDialogOpen,
  ] = useState(false);
  const [
    testSlackAlertConfirmationDialogOpen,
    setTestSlackAlertConfirmationDialogOpen,
  ] = useState(false);

  const router = useRouter();

  // Show a toast for an error or success message passed as a query param, for
  // example after the Slack OAuth redirect, then strip it from the URL. This runs
  // in an effect so the toast dispatch never happens during render. The params
  // are read from window.location rather than useSearchParams: they only arrive
  // on a full-page redirect, so a one-time read at mount always sees them, and
  // nothing rendered depends on them, so there is no param change to subscribe to.
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);

      const errorMsg = params.get("error");
      if (errorMsg) {
        toastNegative(`${errorMsg}`);
        params.delete("error");
      }

      const successMsg = params.get("success");
      if (successMsg) {
        toastPositive(`${successMsg}`);
        params.delete("success");
      }

      if (errorMsg || successMsg) {
        const query = params.toString();
        window.history.replaceState(
          {},
          "",
          query
            ? `${window.location.pathname}?${query}`
            : window.location.pathname,
        );
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const teamNameChangeSessionKey = "teamNameChanged";

  function showToastForTeamNameChangeIfNeeded() {
    if (
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(teamNameChangeSessionKey) === "true"
    ) {
      toastPositive(`Team name changed`);
      window.sessionStorage.removeItem(teamNameChangeSessionKey);
    }
  }

  useEffect(() => {
    showToastForTeamNameChangeIfNeeded();
  }, []);

  const resendPendingInvite = async () => {
    resendPendingInviteMutation.mutate(
      { teamId: params.teamId, inviteId: resendPendingInviteId },
      {
        onSuccess: () => {
          toastPositive(
            "Pending invite for " +
              resendPendingInviteEmail +
              " has been resent",
          );
        },
        onError: () => {
          toastNegative("Error resending invite");
        },
      },
    );
  };

  const removePendingInvite = async () => {
    removePendingInviteMutation.mutate(
      { teamId: params.teamId, inviteId: removePendingInviteId },
      {
        onSuccess: () => {
          toastPositive(
            "Pending invite for " +
              removePendingInviteEmail +
              " has been removed",
          );
        },
        onError: () => {
          toastNegative("Error removing pending invite");
        },
      },
    );
  };

  const handleChangeTeamName = async () => {
    changeTeamNameMutation.mutate(
      { teamId: params.teamId, newName: newTeamName },
      {
        onSuccess: () => {
          window.sessionStorage.setItem(teamNameChangeSessionKey, "true");
          location.reload();
        },
        onError: () => {
          toastNegative("Error changing team name");
        },
      },
    );
  };

  const changeRole = async () => {
    changeRoleMutation.mutate(
      {
        teamId: params.teamId,
        newRole: roleChangeNewRole,
        memberId: roleChangeMemberId,
      },
      {
        onSuccess: () => {
          toastPositive(roleChangeMemberEmail + "'s role changed");
        },
        onError: () => {
          toastNegative("Error changing role");
        },
      },
    );
  };

  const updateSlackStatus = async (status: boolean) => {
    updateSlackStatusMutation.mutate(
      { teamId: params.teamId, status },
      {
        onSuccess: () => {
          toastPositive(
            `Slack integration ${status ? "enabled" : "disabled"} successfully`,
          );
        },
        onError: () => {
          toastNegative(
            `Error ${status ? "enabling" : "disabling"} Slack integration`,
          );
        },
      },
    );
  };

  const retrySlackQueries = () => {
    if (slackStatusQuery.status === "error") {
      slackStatusQuery.refetch();
    }
    if (slackConnectUrlQuery.status === "error") {
      slackConnectUrlQuery.refetch();
    }
  };

  const testSlackAlert = async () => {
    testSlackAlertMutation.mutate(
      { teamId: params.teamId },
      {
        onSuccess: () => {
          toastPositive(`Slack integration test alert sent successfully`);
        },
        onError: (error) => {
          toastNegative(error.message);
        },
      },
    );
  };

  const removeTeamSlack = async () => {
    removeTeamSlackMutation.mutate(
      { teamId: params.teamId },
      {
        onSuccess: () => {
          toastPositive("Slack connection removed");
        },
        onError: () => {
          toastNegative("Error removing Slack connection");
        },
      },
    );
  };

  const inviteMember = async () => {
    inviteMemberMutation.mutate(
      {
        teamId: params.teamId,
        email: inviteMemberEmail,
        role: inviteMemberRole,
      },
      {
        onSuccess: () => {
          toastPositive(inviteMemberEmail + " has been invited");
          setInviteMemberEmail("");
        },
        onError: () => {
          toastNegative("Error inviting member");
        },
      },
    );
  };

  const removeMember = async () => {
    removeMemberMutation.mutate(
      { teamId: params.teamId, memberId: removeMemberId },
      {
        onSuccess: () => {
          toastPositive(removeMemberEmail + " has been removed");
        },
        onError: () => {
          toastNegative("Error removing member");
        },
      },
    );
  };

  return (
    <div className="flex flex-col items-start">
      <div className="flex w-full justify-end">
        <CreateTeam
          disabled={teamsQuery.status === "pending"}
          onSuccess={(teamId) => router.push(`/${teamId}/team`)}
        />
      </div>

      {/* Loading skeleton for full page */}
      {teamsQuery.status === "pending" && (
        <div className="flex flex-col items-start w-full">
          {/* Invite Team Members */}
          <div className="py-6" />
          <Skeleton className="h-6 w-48" />
          <div className="flex flex-row items-center mt-2 gap-2">
            <Skeleton className="h-9 w-96" />
            <Skeleton className="h-9 w-[150px]" />
            <Skeleton className="h-9 w-20" />
          </div>

          {/* Members */}
          <div className="py-8" />
          <Skeleton className="h-6 w-24" />
          <div className="py-2" />
          <SkeletonTable rows={3} columns={2} />

          {/* Pending Invites */}
          <div className="mt-16 mb-6">
            <Skeleton className="h-6 w-36" />
          </div>
          <SkeletonTable rows={2} columns={6} />

          {/* Slack Integration */}
          <div className="py-8" />
          <Skeleton className="h-6 w-40" />
          <div className="py-4" />
          <Skeleton className="h-10 w-36 rounded-lg" />

          {/* Change Team Name */}
          <div className="py-8" />
          <Skeleton className="h-6 w-44" />
          <div className="flex flex-row items-center mt-2 gap-4">
            <Skeleton className="h-9 w-96" />
            <Skeleton className="h-9 w-16" />
          </div>
        </div>
      )}

      {/* Error message for team fetch error */}
      {teamsQuery.status === "error" && (
        <p className="font-body text-sm">
          Error fetching team, please refresh page to try again
        </p>
      )}

      {teamsQuery.status === "success" && (
        <div className="flex flex-col items-start">
          {/* Dialog for confirming pending invite resend */}
          <DangerConfirmationDialog
            body={
              <p className="font-body">
                Are you sure you want to resend pending invite for{" "}
                <span className="font-display font-bold">
                  {resendPendingInviteEmail}
                </span>
                ?
              </p>
            }
            open={resendPendingInviteConfirmationDialogOpen}
            affirmativeText="Yes, I'm sure"
            cancelText="Cancel"
            onAffirmativeAction={() => {
              setResendPendingInviteConfirmationDialogOpen(false);
              resendPendingInvite();
            }}
            onCancelAction={() =>
              setResendPendingInviteConfirmationDialogOpen(false)
            }
          />

          {/* Dialog for confirming pending invite removal */}
          <DangerConfirmationDialog
            body={
              <p className="font-body">
                Are you sure you want to remove pending invite for{" "}
                <span className="font-display font-bold">
                  {removePendingInviteEmail}
                </span>
                ?
              </p>
            }
            open={removePendingInviteConfirmationDialogOpen}
            affirmativeText="Yes, I'm sure"
            cancelText="Cancel"
            onAffirmativeAction={() => {
              setRemovePendingInviteConfirmationDialogOpen(false);
              removePendingInvite();
            }}
            onCancelAction={() =>
              setRemovePendingInviteConfirmationDialogOpen(false)
            }
          />

          {/* Dialog for confirming team name change */}
          <DangerConfirmationDialog
            body={
              <p className="font-body">
                Are you sure you want to rename team{" "}
                <span className="font-display font-bold">{team!.name}</span> to{" "}
                <span className="font-display font-bold">{newTeamName}</span>?
              </p>
            }
            open={teamNameConfirmationDialogOpen}
            affirmativeText="Yes, I'm sure"
            cancelText="Cancel"
            onAffirmativeAction={() => {
              setTeamNameConfirmationDialogOpen(false);
              handleChangeTeamName();
            }}
            onCancelAction={() => setTeamNameConfirmationDialogOpen(false)}
          />

          {/* Dialog for confirming role change */}
          <DangerConfirmationDialog
            body={
              <p className="font-body">
                Are you sure you want to change the role of{" "}
                <span className="font-display font-bold">
                  {roleChangeMemberEmail}
                </span>{" "}
                from{" "}
                <span className="font-display font-bold">
                  {roleChangeOldRole}
                </span>{" "}
                to{" "}
                <span className="font-display font-bold">
                  {roleChangeNewRole}
                </span>
                ?
              </p>
            }
            open={changeRoleConfirmationDialogOpen}
            affirmativeText="Yes, I'm sure"
            cancelText="Cancel"
            onAffirmativeAction={() => {
              setChangeRoleConfirmationDialogOpen(false);
              changeRole();
            }}
            onCancelAction={() => setChangeRoleConfirmationDialogOpen(false)}
          />

          {/* Dialog for confirming member removal */}
          <DangerConfirmationDialog
            body={
              <p className="font-body">
                Are you sure you want to remove{" "}
                <span className="font-display font-bold">
                  {removeMemberEmail}
                </span>{" "}
                from team{" "}
                <span className="font-display font-bold">{team!.name}</span>?
              </p>
            }
            open={removeMemberConfirmationDialogOpen}
            affirmativeText="Yes, I'm sure"
            cancelText="Cancel"
            onAffirmativeAction={() => {
              setRemoveMemberConfirmationDialogOpen(false);
              removeMember();
            }}
            onCancelAction={() => setRemoveMemberConfirmationDialogOpen(false)}
          />

          {/* Dialog for confirming slack disable */}
          <DangerConfirmationDialog
            body={
              <p className="font-body">
                Are you sure you want to disable Slack integration for team{" "}
                <span className="font-display font-bold">{team!.name}</span>?
                <br />
                <br />
                This will stop all Slack alerts and Measure Agent&apos;s replies
                in Slack.
              </p>
            }
            open={disableSlackConfirmationDialogOpen}
            affirmativeText="Yes, I'm sure"
            cancelText="Cancel"
            onAffirmativeAction={() => {
              setDisableSlackConfirmationDialogOpen(false);
              updateSlackStatus(false);
            }}
            onCancelAction={() => setDisableSlackConfirmationDialogOpen(false)}
          />

          {/* Dialog for confirming slack connection removal */}
          <DangerConfirmationDialog
            body={
              <p className="font-body">
                Are you sure you want to remove the Slack connection for team{" "}
                <span className="font-display font-bold">{team!.name}</span>?
                <br />
                <br />
                This will delete your Slack connection and your subscribed alert
                channels. The Measure Slack bot will no longer send any alerts
                or messages.
                <br />
                <br />
                The Measure app will remain in your workspace. You can manually
                uninstall it from your Slack workspace settings.
              </p>
            }
            open={removeSlackConfirmationDialogOpen}
            affirmativeText="Yes, I'm sure"
            cancelText="Cancel"
            onAffirmativeAction={() => {
              setRemoveSlackConfirmationDialogOpen(false);
              removeTeamSlack();
            }}
            onCancelAction={() => setRemoveSlackConfirmationDialogOpen(false)}
          />

          {/* Dialog for confirming test slack alert */}
          <ConfirmationDialog
            body={
              <p className="font-body">
                Are you sure you want to send test alert notifications?
                <br />
                <br /> This will send test messages to all subscribed alert
                channels in Slack.{" "}
              </p>
            }
            open={testSlackAlertConfirmationDialogOpen}
            affirmativeText="Yes, I'm sure"
            cancelText="Cancel"
            onAffirmativeAction={() => {
              setTestSlackAlertConfirmationDialogOpen(false);
              testSlackAlert();
            }}
            onCancelAction={() =>
              setTestSlackAlertConfirmationDialogOpen(false)
            }
          />

          <div className="py-6" />
          <p className="font-display text-xl max-w-6xl text-center">
            Invite Team Members
          </p>
          <div className="flex flex-row items-center">
            <Input
              id="invite-email-input"
              name="invite-email-input"
              type="email"
              placeholder="Enter email"
              className="w-96 font-body"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setInviteMemberEmail(e.target.value)
              }
              value={inviteMemberEmail}
            />
            <div className="px-2" />
            <DropdownSelect
              title="Roles"
              type={DropdownSelectType.SingleString}
              items={authz.can_invite_roles.map((i: string) =>
                formatToCamelCase(i),
              )}
              initialSelected={
                authz.can_invite_roles.length > 0
                  ? formatToCamelCase(authz.can_invite_roles[0])
                  : ""
              }
              disabled={authz.can_invite_roles.length === 0}
              onChangeSelected={(item) => setInviteMemberRole(item as string)}
            />
            <Button
              variant="outline"
              className="m-4"
              disabled={
                authz.can_invite_roles.length === 0 ||
                inviteMemberMutation.isPending ||
                inviteMemberEmail === ""
              }
              loading={inviteMemberMutation.isPending}
              onClick={inviteMember}
            >
              Invite
            </Button>
          </div>

          <div className="py-8" />
          <p className="font-display text-xl max-w-6xl text-center">Members</p>
          <div className="py-2" />
          {/* Loading message for fetch members */}
          {authzAndMembersQuery.status === "pending" && (
            <SkeletonTable rows={3} columns={2} />
          )}
          {/* Error message for fetch members */}
          {authzAndMembersQuery.status === "error" && (
            <p className="font-body text-sm">
              Error fetching team members, please refresh page to try again
            </p>
          )}

          {authzAndMembersQuery.status === "success" && (
            <Table className="font-display select-none table-auto w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-96">Member</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {authz.members.map(
                  ({
                    id,
                    email,
                    role,
                    authz: memberAuthz,
                  }: {
                    id: string;
                    email: string;
                    role: string;
                    authz: {
                      current_user_assignable_roles_for_member: string[] | null;
                      current_user_can_remove_member: boolean;
                    };
                  }) => (
                    <TableRow key={id} className="font-body">
                      <TableCell className="min-w-96 truncate">
                        {email}
                      </TableCell>

                      {/* Show only if row is current user */}
                      {id === currentUserId && (
                        <TableCell>{formatToCamelCase(role)}</TableCell>
                      )}

                      {/* Show roles dropdown if not current user */}
                      {id !== currentUserId && (
                        <TableCell>
                          {/* If roles can be changed for members, add roles to dropdown and set selected role to current role */}
                          {memberAuthz.current_user_assignable_roles_for_member !==
                            null &&
                            memberAuthz.current_user_assignable_roles_for_member
                              .length > 0 && (
                              <DropdownSelect
                                title="Roles"
                                type={DropdownSelectType.SingleString}
                                items={memberAuthz.current_user_assignable_roles_for_member.map(
                                  (i: string) => formatToCamelCase(i),
                                )}
                                initialSelected={formatToCamelCase(role)}
                                onChangeSelected={(i) => {
                                  const newMap = new Map(
                                    selectedDropdownRolesMap,
                                  );
                                  newMap.set(
                                    id,
                                    (i as string).toLocaleLowerCase(),
                                  );
                                  setSelectedDropdownRolesMap(newMap);
                                }}
                              />
                            )}
                          {/* If roles cannot be changed for current member, just show current role as part of dropdown */}
                          {(memberAuthz.current_user_assignable_roles_for_member ===
                            null ||
                            memberAuthz.current_user_assignable_roles_for_member
                              .length === 0) && (
                            <DropdownSelect
                              title="Current Role"
                              type={DropdownSelectType.SingleString}
                              items={[formatToCamelCase(role)]}
                              initialSelected={formatToCamelCase(role)}
                            />
                          )}
                        </TableCell>
                      )}

                      {/* Show change role button if not current user */}
                      {id !== currentUserId && (
                        <TableCell>
                          <Button
                            variant="outline"
                            disabled={
                              selectedDropdownRolesMap.get(id) === undefined ||
                              selectedDropdownRolesMap.get(id) === role
                            }
                            loading={
                              changeRoleMutation.isPending &&
                              roleChangeMemberId === id
                            }
                            onClick={() => {
                              setRoleChangeMemberId(id);
                              setRoleChangeMemberEmail(
                                authz.members.filter(
                                  (i: AuthzMember) => i.id === id,
                                )[0].email,
                              );
                              setRoleChangeOldRole(
                                formatToCamelCase(
                                  authz.members.filter(
                                    (i: AuthzMember) => i.id === id,
                                  )[0].role,
                                ),
                              );
                              setRoleChangeNewRole(
                                selectedDropdownRolesMap.get(id) as string,
                              );
                              setChangeRoleConfirmationDialogOpen(true);
                            }}
                          >
                            Change Role
                          </Button>
                        </TableCell>
                      )}

                      {/* Show remove member button if not current user */}
                      {id !== currentUserId && (
                        <TableCell>
                          <Button
                            variant="outline"
                            disabled={
                              memberAuthz.current_user_can_remove_member ===
                                false || removeMemberMutation.isPending
                            }
                            loading={
                              removeMemberMutation.isPending &&
                              removeMemberId === id
                            }
                            onClick={() => {
                              setRemoveMemberId(id);
                              setRemoveMemberEmail(
                                authz.members.filter(
                                  (i: AuthzMember) => i.id === id,
                                )[0].email,
                              );
                              setRemoveMemberConfirmationDialogOpen(true);
                            }}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ),
                )}
              </TableBody>
            </Table>
          )}

          {(pendingInvitesQuery.status !== "success" ||
            (pendingInvitesQuery.status === "success" &&
              pendingInvites &&
              pendingInvites.length > 0)) && (
            <p className="mt-16 mb-6 font-display text-xl max-w-6xl text-center">
              Pending Invites
            </p>
          )}
          {/* Loading message for fetch pending invites */}
          {pendingInvitesQuery.status === "pending" && (
            <SkeletonTable rows={2} columns={4} />
          )}
          {/* Error message for fetch pending invites */}
          {pendingInvitesQuery.status === "error" && (
            <p className="font-body text-sm">
              Error fetching pending invites, please refresh page to try again
            </p>
          )}

          {authzAndMembersQuery.status === "success" &&
            pendingInvitesQuery.status === "success" &&
            pendingInvites &&
            pendingInvites.length > 0 && (
              <Table className="font-display select-none table-auto w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-64">Invitee</TableHead>
                    <TableHead className="min-w-64">Invited By</TableHead>
                    <TableHead className="min-w-24 text-center">
                      Invited As
                    </TableHead>
                    <TableHead className="min-w-48 text-center">
                      Valid Until
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingInvites.map(
                    ({
                      id,
                      email,
                      invited_by_email,
                      role,
                      valid_until,
                    }: {
                      id: string;
                      email: string;
                      invited_by_email: string;
                      role: string;
                      valid_until: string;
                    }) => (
                      <TableRow key={id} className="font-body">
                        <TableCell className="truncate" title={email}>
                          {email}
                        </TableCell>
                        <TableCell
                          className="truncate"
                          title={invited_by_email}
                        >
                          {invited_by_email}
                        </TableCell>
                        <TableCell className="text-center">
                          {formatToCamelCase(role)}
                        </TableCell>
                        <TableCell className="text-center">
                          {formatDateToHumanReadableDateTime(valid_until)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            disabled={
                              !authz.can_invite_roles.includes(role) ||
                              resendPendingInviteMutation.isPending
                            }
                            loading={
                              resendPendingInviteMutation.isPending &&
                              resendPendingInviteId === id
                            }
                            onClick={() => {
                              setResendPendingInviteId(id);
                              setResendPendingInviteEmail(email);
                              setResendPendingInviteConfirmationDialogOpen(
                                true,
                              );
                            }}
                          >
                            Resend
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            disabled={
                              !authz.can_invite_roles.includes(role) ||
                              removePendingInviteMutation.isPending
                            }
                            loading={
                              removePendingInviteMutation.isPending &&
                              removePendingInviteId === id
                            }
                            onClick={() => {
                              setRemovePendingInviteId(id);
                              setRemovePendingInviteEmail(email);
                              setRemovePendingInviteConfirmationDialogOpen(
                                true,
                              );
                            }}
                          >
                            Revoke
                          </Button>
                        </TableCell>
                      </TableRow>
                    ),
                  )}
                </TableBody>
              </Table>
            )}

          <div className="py-8" />
          <div className="flex items-center gap-2">
            <p className="font-display text-xl max-w-6xl text-center">
              Slack Integration
            </p>
            <InfoTooltip
              content={
                <>
                  Receive alert notifications and daily summaries in Slack.{" "}
                  <Link
                    className={underlineLinkStyle}
                    href="/docs/features/feature-slack-integration"
                  >
                    Learn more
                  </Link>
                </>
              }
            />
          </div>
          <div className="py-2" />
          {slackSection === "loading" && (
            <div className="flex flex-col gap-3 w-full max-w-md">
              <Skeleton className="h-10 w-48 rounded-lg" />
              <Skeleton className="h-4 w-32" />
            </div>
          )}

          {/* the status fetch failed, or a manager's connect url fetch failed */}
          {slackSection === "error" && (
            <div className="flex flex-col items-start gap-4">
              <p className="font-body text-sm">
                Error fetching Slack Integration status.
                {!isCloud() && (
                  <>
                    {" "}
                    Follow our{" "}
                    <Link
                      className={underlineLinkStyle}
                      href="/docs/hosting/slack"
                    >
                      guide
                    </Link>{" "}
                    to set it up if you haven&apos;t done so.
                  </>
                )}
              </p>
              <Button
                variant="outline"
                loading={
                  slackStatusQuery.isRefetching ||
                  slackConnectUrlQuery.isRefetching
                }
                onClick={retrySlackQueries}
              >
                Try again
              </Button>
            </div>
          )}

          {/* the authz fetch failed, so which not-connected view applies is unknown */}
          {slackSection === "authzError" && (
            <p className="font-body text-sm">
              Could not verify authorization. Please refresh to try again.
            </p>
          )}

          {/* slack not connected, show add to slack button */}
          {slackSection === "canConnect" && (
            <a href={teamSlackConnectUrl!}>
              <Image
                alt="Add to Slack"
                height={40}
                width={139}
                src="https://platform.slack-edge.com/img/add_to_slack@2x.png"
                unoptimized
              />
            </a>
          )}

          {/* slack not connected and the user cannot change that */}
          {slackSection === "cannotConnect" && (
            <p className="font-body text-sm">
              Slack is not connected. Please ask a team owner to connect it.
            </p>
          )}

          {/* slack connected, show switch */}
          {slackSection === "connected" && (
            <div className="flex flex-col w-full">
              {slackReauthPrompt !== null && (
                <div
                  className={`${warningCalloutStyle} mb-6 flex flex-col gap-2`}
                >
                  <span>
                    This Slack connection is missing newer permissions.
                    Reconnect to enable Measure Agent. Slack does not prompt
                    existing connections about new permissions.
                  </span>
                  {slackReauthPrompt === "reconnectLink" && (
                    <Link
                      href={teamSlackConnectUrl!}
                      className="font-semibold underline w-fit whitespace-nowrap"
                    >
                      Reconnect Slack →
                    </Link>
                  )}
                  {slackReauthPrompt === "askOwner" && (
                    <span className="whitespace-nowrap italic">
                      Ask a team owner to reconnect.
                    </span>
                  )}
                </div>
              )}
              <div className="flex flex-row w-full items-center justify-between">
                <p className="font-body">
                  Connected to{" "}
                  <span className="font-semibold">
                    {teamSlack.slack_team_name}
                  </span>{" "}
                  workspace
                </p>
                <Switch
                  disabled={
                    !authz.can_manage_slack ||
                    updateSlackStatusMutation.isPending
                  }
                  checked={teamSlack.is_active}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      updateSlackStatus(true);
                    } else {
                      setDisableSlackConfirmationDialogOpen(true);
                    }
                  }}
                />
              </div>

              <div className="py-4" />

              <div className="flex flex-row w-full items-center justify-between">
                <Button
                  variant="outline"
                  className="w-fit"
                  disabled={
                    !authz.can_manage_slack ||
                    testSlackAlertMutation.isPending ||
                    teamSlack.is_active === false
                  }
                  loading={testSlackAlertMutation.isPending}
                  onClick={() => setTestSlackAlertConfirmationDialogOpen(true)}
                >
                  Send Test Alert
                </Button>
                <Button
                  variant="destructive"
                  className="w-fit"
                  aria-label="Remove Slack connection"
                  disabled={
                    !authz.can_manage_slack || removeTeamSlackMutation.isPending
                  }
                  loading={removeTeamSlackMutation.isPending}
                  onClick={() => setRemoveSlackConfirmationDialogOpen(true)}
                >
                  Remove
                </Button>
              </div>
            </div>
          )}

          <div className="py-8" />
          <p className="font-display text-xl max-w-6xl text-center">
            Change Team Name
          </p>
          <div className="flex flex-row items-center">
            <Input
              id="change-team-name-input"
              type="text"
              defaultValue={team!.name}
              onChange={(event) => {
                event.target.value === team!.name
                  ? setSaveTeamNameButtonDisabled(true)
                  : setSaveTeamNameButtonDisabled(false);
                setNewTeamName(event.target.value);
              }}
              className="w-96 font-body"
            />
            <Button
              variant="outline"
              className="m-4"
              disabled={
                !authz.can_rename_team ||
                saveTeamNameButtonDisabled ||
                changeTeamNameMutation.isPending
              }
              loading={changeTeamNameMutation.isPending}
              onClick={() => setTeamNameConfirmationDialogOpen(true)}
            >
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
