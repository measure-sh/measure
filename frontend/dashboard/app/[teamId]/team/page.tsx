"use client";
import {
  useAuthzAndMembersQuery,
  useChangeRoleMutation,
  useChangeTeamNameMutation,
  useInviteMemberMutation,
  usePendingInvitesQuery,
  useRemoveMemberMutation,
  useRemovePendingInviteMutation,
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
import { underlineLinkStyle } from "@/app/utils/shared_styles";
import { formatToCamelCase } from "@/app/utils/string_utils";
import { formatDateToHumanReadableDateTime } from "@/app/utils/time_utils";
import { toastNegative, toastPositive } from "@/app/utils/use_toast";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function TeamOverview({
  params,
}: {
  params: { teamId: string };
}) {
  const { data: teams, status: teamsStatus } = useTeamsQuery();
  const team = teams?.find((t) => t.id === params.teamId) ?? null;

  // Get current user ID from session query
  const sessionQuery = useSessionQuery();
  const currentUserId = sessionQuery.data?.user?.id;

  // TanStack Query: reads
  const { data: authzAndMembers, status: authzAndMembersStatus } =
    useAuthzAndMembersQuery(params.teamId);
  const { data: pendingInvites, status: pendingInvitesStatus } =
    usePendingInvitesQuery(params.teamId);
  const { data: teamSlackConnectUrl, status: slackConnectUrlStatus } =
    useTeamSlackConnectUrlQuery(
      currentUserId,
      params.teamId,
      `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback/slack`,
    );
  const { data: teamSlack, status: slackStatusQueryStatus } =
    useTeamSlackStatusQuery(params.teamId);

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

  // Use authzAndMembers data or fallback defaults
  const authz = authzAndMembers ?? defaultAuthzAndMembers;

  // TanStack Query: mutations
  const changeTeamNameMutation = useChangeTeamNameMutation();
  const inviteMemberMutation = useInviteMemberMutation();
  const removeMemberMutation = useRemoveMemberMutation();
  const resendPendingInviteMutation = useResendPendingInviteMutation();
  const removePendingInviteMutation = useRemovePendingInviteMutation();
  const changeRoleMutation = useChangeRoleMutation();
  const updateSlackStatusMutation = useUpdateSlackStatusMutation();
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
    testSlackAlertConfirmationDialogOpen,
    setTestSlackAlertConfirmationDialogOpen,
  ] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  if (typeof window !== "undefined") {
    const errorMsgParam = "error";
    const errorMsg = searchParams.get(errorMsgParam);
    if (errorMsg) {
      toastNegative(`${errorMsg}`);
      const params = new URLSearchParams(searchParams.toString());
      params.delete(errorMsgParam);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, "", newUrl);
    }

    const successMsgParam = "success";
    const successMsg = searchParams.get(successMsgParam);
    if (successMsg) {
      toastPositive(`${successMsg}`);
      const params = new URLSearchParams(searchParams.toString());
      params.delete(successMsgParam);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, "", newUrl);
    }
  }

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

  const testSlackAlert = async () => {
    testSlackAlertMutation.mutate(
      { teamId: params.teamId },
      {
        onSuccess: () => {
          toastPositive(`Slack integration test alert sent successfully`);
        },
        onError: () => {
          toastNegative(`Error sending test Slack alerts`);
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
          disabled={teamsStatus === "pending"}
          onSuccess={(teamId) => router.push(`/${teamId}/team`)}
        />
      </div>

      {/* Loading skeleton for full page */}
      {teamsStatus === "pending" && (
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
          <Skeleton className="h-3 w-80 mt-2" />
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
      {teamsStatus === "error" && (
        <p className="font-body text-sm">
          Error fetching team, please refresh page to try again
        </p>
      )}

      {teamsStatus === "success" && (
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
                This will stop all Slack notifications for this team.
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
              onInput={(e: React.ChangeEvent<HTMLInputElement>) =>
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
          {authzAndMembersStatus === "pending" && (
            <SkeletonTable rows={3} columns={2} />
          )}
          {/* Error message for fetch members */}
          {authzAndMembersStatus === "error" && (
            <p className="font-body text-sm">
              Error fetching team members, please refresh page to try again
            </p>
          )}

          {authzAndMembersStatus === "success" && (
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

          {(pendingInvitesStatus !== "success" ||
            (pendingInvitesStatus === "success" &&
              pendingInvites &&
              pendingInvites.length > 0)) && (
            <p className="mt-16 mb-6 font-display text-xl max-w-6xl text-center">
              Pending Invites
            </p>
          )}
          {/* Loading message for fetch pending invites */}
          {pendingInvitesStatus === "pending" && (
            <SkeletonTable rows={2} columns={4} />
          )}
          {/* Error message for fetch pending invites */}
          {pendingInvitesStatus === "error" && (
            <p className="font-body text-sm">
              Error fetching pending invites, please refresh page to try again
            </p>
          )}

          {authzAndMembersStatus === "success" &&
            pendingInvitesStatus === "success" &&
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
          <p className="font-display text-xl max-w-6xl text-center">
            Slack Integration
          </p>
          <p className="mt-2 font-body text-xs text-muted-foreground">
            Receive alert notifications and daily summaries in Slack.{" "}
            <Link
              className={underlineLinkStyle}
              href="/docs/features/feature-slack-integration"
            >
              Learn more
            </Link>
          </p>
          <div className="py-4" />
          {(slackStatusQueryStatus === "pending" ||
            slackConnectUrlStatus === "pending") && (
            <div className="flex flex-col gap-3 w-full max-w-md">
              <Skeleton className="h-10 w-48 rounded-lg" />
              <Skeleton className="h-4 w-32" />
            </div>
          )}

          {/* error creating slack url or fetching team slack status */}
          {(slackConnectUrlStatus === "error" ||
            slackStatusQueryStatus === "error") && (
            <p className="font-body text-sm">
              Error fetching Slack Integration status. Follow our{" "}
              <Link className={underlineLinkStyle} href="/docs/hosting/slack">
                guide
              </Link>{" "}
              to set it up if you haven&apos;t done so.
            </p>
          )}

          {/* slack not connected, show add to slack button */}
          {slackConnectUrlStatus === "success" &&
          slackStatusQueryStatus === "success" &&
          teamSlack === null ? (
            <a
              aria-disabled={!authz.can_manage_slack}
              onClick={(e) => {
                if (!authz.can_manage_slack) {
                  e.preventDefault();
                }
              }}
              href={teamSlackConnectUrl!}
            >
              <Image
                alt="Add to Slack"
                height={40}
                width={139}
                src="https://platform.slack-edge.com/img/add_to_slack@2x.png"
                unoptimized
              />
            </a>
          ) : (
            ""
          )}

          {/* slack connected, show switch */}
          {slackConnectUrlStatus === "success" &&
            slackStatusQueryStatus === "success" &&
            teamSlack !== null && (
              <div className="flex flex-col w-full">
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
