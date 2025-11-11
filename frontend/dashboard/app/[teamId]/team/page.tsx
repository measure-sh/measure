"use client"

import { AuthzAndMembersApiStatus, FetchTeamSlackConnectUrlApiStatus, FetchTeamSlackStatusApiStatus, InviteMemberApiStatus, PendingInvite, PendingInvitesApiStatus, RemoveMemberApiStatus, RemovePendingInviteApiStatus, ResendPendingInviteApiStatus, RoleChangeApiStatus, Team, TeamNameChangeApiStatus, TeamsApiStatus, TestSlackAlertApiStatus, UpdateTeamSlackStatusApiStatus, changeRoleFromServer, changeTeamNameFromServer, defaultAuthzAndMembers, fetchAuthzAndMembersFromServer, fetchPendingInvitesFromServer, fetchTeamSlackConnectUrlFromServer, fetchTeamSlackStatusFromServer, fetchTeamsFromServer, inviteMemberFromServer, removeMemberFromServer, removePendingInviteFromServer, resendPendingInviteFromServer, sendTestSlackAlertFromServer, updateTeamSlackStatusFromServer } from "@/app/api/api_calls"
import { measureAuth } from "@/app/auth/measure_auth"
import { Button } from "@/app/components/button"
import ConfirmationDialog from "@/app/components/confirmation_dialog"
import CreateTeam from "@/app/components/create_team"
import DangerConfirmationDialog from "@/app/components/danger_confirmation_dialog"
import DropdownSelect, { DropdownSelectType } from "@/app/components/dropdown_select"
import { Input } from "@/app/components/input"
import LoadingSpinner from "@/app/components/loading_spinner"
import { Switch } from "@/app/components/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/table"
import { underlineLinkStyle } from "@/app/utils/shared_styles"
import { formatToCamelCase } from "@/app/utils/string_utils"
import { formatDateToHumanReadableDateTime } from "@/app/utils/time_utils"
import { toastNegative, toastPositive } from "@/app/utils/use_toast"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

export default function TeamOverview({ params }: { params: { teamId: string } }) {
  const [teamsApiStatus, setTeamsApiStatus] = useState(TeamsApiStatus.Loading)
  const [team, setTeam] = useState<Team | null>()

  const [currentUserId, setCurrentUserId] = useState<string>()

  const [saveTeamNameButtonDisabled, setSaveTeamNameButtonDisabled] = useState(true)

  const [teamNameConfirmationDialogOpen, setTeamNameConfirmationDialogOpen] = useState(false)
  const [teamNameChangeApiStatus, setTeamNameChangeApiStatus] = useState(TeamNameChangeApiStatus.Init)
  const [newTeamName, setNewTeamName] = useState('')

  const [inviteMemberApiStatus, setInviteMemberApiStatus] = useState(InviteMemberApiStatus.Init)
  const [inviteMemberRole, setInviteMemberRole] = useState("Owner")
  const [inviteMemberEmail, setInviteMemberEmail] = useState("")

  const [removeMemberApiStatus, setRemoveMemberApiStatus] = useState(RemoveMemberApiStatus.Init)
  const [removeMemberConfirmationDialogOpen, setRemoveMemberConfirmationDialogOpen] = useState(false)
  const [removeMemberId, setRemoveMemberId] = useState("")
  const [removeMemberEmail, setRemoveMemberEmail] = useState("")

  const [getAuthzAndMembersApiStatus, setAuthzAndMembersApiStatus] = useState(AuthzAndMembersApiStatus.Loading)
  const [authzAndMembers, setAuthzAndMembers] = useState(defaultAuthzAndMembers)

  const [pendingInvitesApiStatus, setPendingInvitesApiStatus] = useState(PendingInvitesApiStatus.Loading)
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[] | null>(null)

  const [resendPendingInviteConfirmationDialogOpen, setResendPendingInviteConfirmationDialogOpen] = useState(false)
  const [resendPendingInviteApiStatus, setResendPendingInviteApiStatus] = useState(ResendPendingInviteApiStatus.Init)
  const [resendPendingInviteId, setResendPendingInviteId] = useState("")
  const [resendPendingInviteEmail, setResendPendingInviteEmail] = useState("")

  const [removePendingInviteConfirmationDialogOpen, setRemovePendingInviteConfirmationDialogOpen] = useState(false)
  const [removePendingInviteApiStatus, setRemovePendingInviteApiStatus] = useState(RemovePendingInviteApiStatus.Init)
  const [removePendingInviteId, setRemovePendingInviteId] = useState("")
  const [removePendingInviteEmail, setRemovePendingInviteEmail] = useState("")

  const [selectedDropdownRolesMap, setSelectedDropdownRolesMap] = useState<Map<String, String>>(new Map())
  const [changeRoleConfirmationDialogOpen, setChangeRoleConfirmationDialogOpen] = useState(false)
  const [roleChangeApiStatus, setRoleChangeApiStatus] = useState(RoleChangeApiStatus.Init)
  const [roleChangeMemberId, setRoleChangeMemberId] = useState("")
  const [roleChangeMemberEmail, setRoleChangeMemberEmail] = useState("")
  const [roleChangeOldRole, setRoleChangeOldRole] = useState("")
  const [roleChangeNewRole, setRoleChangeNewRole] = useState("")

  const [fetchTeamSlackConnectUrlApiStatus, setFetchTeamSlackConnectUrlApiStatus] = useState(FetchTeamSlackConnectUrlApiStatus.Init)
  const [fetchTeamSlackStatusApiStatus, setFetchTeamSlackStatusApiStatus] = useState(FetchTeamSlackStatusApiStatus.Init)
  const [updateTeamSlackStatusApiStatus, setUpdateTeamSlackStatusApiStatus] = useState(UpdateTeamSlackStatusApiStatus.Init)
  const [testSlackAlertApiStatus, setTestSlackAlertApiStatus] = useState(TestSlackAlertApiStatus.Init)
  const [teamSlackConnectUrl, setTeamSlackConnectUrl] = useState<string | null>(null)
  const [teamSlack, setTeamSlack] = useState<{ slack_team_name: string, is_active: boolean } | null>(null)
  const [disableSlackConfirmationDialogOpen, setDisableSlackConfirmationDialogOpen] = useState(false)
  const [testSlackAlertConfirmationDialogOpen, setTestSlackAlertConfirmationDialogOpen] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()

  if (typeof window !== "undefined") {
    const errorMsgParam = "error"
    const errorMsg = searchParams.get(errorMsgParam)
    if (errorMsg) {
      toastNegative(`${errorMsg}`)
      const params = new URLSearchParams(searchParams.toString())
      params.delete(errorMsgParam)
      const newUrl = `${window.location.pathname}?${params.toString()}`
      window.history.replaceState({}, "", newUrl)
    }

    const successMsgParam = "success"
    const successMsg = searchParams.get(successMsgParam)
    if (successMsg) {
      toastPositive(`${successMsg}`)
      const params = new URLSearchParams(searchParams.toString())
      params.delete(successMsgParam)
      const newUrl = `${window.location.pathname}?${params.toString()}`
      window.history.replaceState({}, "", newUrl)
    }
  }

  const teamNameChangeSessionKey = "teamNameChanged"

  function showToastForTeamNameChangeIfNeeded() {
    if (typeof window !== 'undefined' && window.sessionStorage.getItem(teamNameChangeSessionKey) === "true") {
      toastPositive(`Team name changed`)
      window.sessionStorage.removeItem(teamNameChangeSessionKey)
    }
  }

  const getTeams = async () => {
    setTeamsApiStatus(TeamsApiStatus.Loading)

    const result = await fetchTeamsFromServer()

    switch (result.status) {
      case TeamsApiStatus.Error:
        setTeamsApiStatus(TeamsApiStatus.Error)
        break
      case TeamsApiStatus.Success:
        setTeamsApiStatus(TeamsApiStatus.Success)
        setTeam(result.data!.filter((i) => i.id === params.teamId)[0])
        showToastForTeamNameChangeIfNeeded()
        break
    }
  }

  useEffect(() => {
    getTeams()
  }, [])

  const getCurrentUserId = async () => {
    const { session, error } = await measureAuth.getSession()
    if (error) {
      console.error("Error getting session: ", error)
      return
    }

    setCurrentUserId(session.user.id)
  }

  useEffect(() => {
    getCurrentUserId()
  }, [])

  const getAuthzAndMembers = async (showLoading: boolean) => {
    if (showLoading) {
      setAuthzAndMembersApiStatus(AuthzAndMembersApiStatus.Loading)
    }

    const result = await fetchAuthzAndMembersFromServer(params.teamId)

    switch (result.status) {
      case AuthzAndMembersApiStatus.Error:
        setAuthzAndMembersApiStatus(AuthzAndMembersApiStatus.Error)
        break
      case AuthzAndMembersApiStatus.Success:
        setAuthzAndMembersApiStatus(AuthzAndMembersApiStatus.Success)
        setAuthzAndMembers(result.data)
        break
    }
  }

  useEffect(() => {
    getAuthzAndMembers(true)
  }, [])

  const getPendingInvites = async (showLoading: boolean) => {
    if (showLoading) {
      setPendingInvitesApiStatus(PendingInvitesApiStatus.Loading)
    }

    const result = await fetchPendingInvitesFromServer(params.teamId)

    switch (result.status) {
      case PendingInvitesApiStatus.Error:
        setPendingInvitesApiStatus(PendingInvitesApiStatus.Error)
        break
      case PendingInvitesApiStatus.Success:
        setPendingInvitesApiStatus(PendingInvitesApiStatus.Success)
        setPendingInvites(result.data)
        break
    }
  }

  useEffect(() => {
    getPendingInvites(true)
  }, [])

  const resendPendingInvite = async () => {
    setResendPendingInviteApiStatus(ResendPendingInviteApiStatus.Loading)

    const result = await resendPendingInviteFromServer(params.teamId, resendPendingInviteId)

    switch (result.status) {
      case ResendPendingInviteApiStatus.Error:
        setResendPendingInviteApiStatus(ResendPendingInviteApiStatus.Error)
        toastNegative("Error resending invite", result.error)
        break
      case ResendPendingInviteApiStatus.Success:
        setResendPendingInviteApiStatus(ResendPendingInviteApiStatus.Success)
        toastPositive("Pending invite for " + resendPendingInviteEmail + " has been resent")
        getPendingInvites(false)
        break
    }
  }

  const removePendingInvite = async () => {
    setRemovePendingInviteApiStatus(RemovePendingInviteApiStatus.Loading)

    const result = await removePendingInviteFromServer(params.teamId, removePendingInviteId)

    switch (result.status) {
      case RemovePendingInviteApiStatus.Error:
        setRemovePendingInviteApiStatus(RemovePendingInviteApiStatus.Error)
        toastNegative("Error removing pending invite", result.error)
        break
      case RemovePendingInviteApiStatus.Success:
        setRemovePendingInviteApiStatus(RemovePendingInviteApiStatus.Success)
        toastPositive("Pending invite for " + removePendingInviteEmail + " has been removed")
        getPendingInvites(false)
        break
    }
  }

  const changeTeamName = async () => {
    setTeamNameChangeApiStatus(TeamNameChangeApiStatus.Loading)

    const result = await changeTeamNameFromServer(params.teamId, newTeamName)

    switch (result.status) {
      case TeamNameChangeApiStatus.Error:
        setTeamNameChangeApiStatus(TeamNameChangeApiStatus.Error)
        toastNegative("Error changing team name")
        break
      case TeamNameChangeApiStatus.Success:
        setTeamNameChangeApiStatus(TeamNameChangeApiStatus.Success)
        // Set flag and new name before reload
        window.sessionStorage.setItem(teamNameChangeSessionKey, "true")
        location.reload()
        break
    }
  }

  const changeRole = async () => {
    setRoleChangeApiStatus(RoleChangeApiStatus.Loading)

    const result = await changeRoleFromServer(params.teamId, roleChangeNewRole, roleChangeMemberId)

    switch (result.status) {
      case RoleChangeApiStatus.Error:
        setRoleChangeApiStatus(RoleChangeApiStatus.Error)
        toastNegative("Error changing role", result.error)
        break
      case RoleChangeApiStatus.Success:
        setRoleChangeApiStatus(RoleChangeApiStatus.Success)
        toastPositive(roleChangeMemberEmail + "'s role changed",)
        getAuthzAndMembers(false)
        break
    }
  }

  const getTeamSlackConnectUrl = async (showLoading: boolean) => {
    if (showLoading) {
      setFetchTeamSlackConnectUrlApiStatus(FetchTeamSlackConnectUrlApiStatus.Loading)
    }

    const result = await fetchTeamSlackConnectUrlFromServer(currentUserId!, params.teamId, `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback/slack`)

    switch (result.status) {
      case FetchTeamSlackConnectUrlApiStatus.Error:
        setFetchTeamSlackConnectUrlApiStatus(FetchTeamSlackConnectUrlApiStatus.Error)
        break
      case FetchTeamSlackConnectUrlApiStatus.Success:
        setFetchTeamSlackConnectUrlApiStatus(FetchTeamSlackConnectUrlApiStatus.Success)
        setTeamSlackConnectUrl(result.data.url)
        break
    }
  }

  useEffect(() => {
    if (currentUserId) {
      getTeamSlackConnectUrl(true)
    }
  }, [currentUserId])

  const getTeamSlackStatus = async (showLoading: boolean) => {
    if (showLoading) {
      setFetchTeamSlackStatusApiStatus(FetchTeamSlackStatusApiStatus.Loading)
    }

    const result = await fetchTeamSlackStatusFromServer(params.teamId)

    switch (result.status) {
      case FetchTeamSlackStatusApiStatus.Error:
        setFetchTeamSlackStatusApiStatus(FetchTeamSlackStatusApiStatus.Error)
        break
      case FetchTeamSlackStatusApiStatus.Success:
        setFetchTeamSlackStatusApiStatus(FetchTeamSlackStatusApiStatus.Success)
        setTeamSlack(result.data)
        break
    }
  }

  useEffect(() => {
    if (teamSlackConnectUrl) {
      getTeamSlackStatus(true)
    }
  }, [teamSlackConnectUrl])

  const updateSlackStatus = async (status: boolean) => {
    setUpdateTeamSlackStatusApiStatus(UpdateTeamSlackStatusApiStatus.Loading)

    const result = await updateTeamSlackStatusFromServer(params.teamId, status)

    switch (result.status) {
      case UpdateTeamSlackStatusApiStatus.Error:
        setUpdateTeamSlackStatusApiStatus(UpdateTeamSlackStatusApiStatus.Error)
        toastNegative(
          `Error ${status ? "enabling" : "disabling"} Slack integration`,
          result.error
        )
        break
      case UpdateTeamSlackStatusApiStatus.Success:
        setUpdateTeamSlackStatusApiStatus(UpdateTeamSlackStatusApiStatus.Success)
        toastPositive(
          `Slack integration ${status ? "enabled" : "disabled"} successfully`
        )
        setTeamSlack({ slack_team_name: teamSlack?.slack_team_name!, is_active: status })
        break
    }
  }

  const testSlackAlert = async () => {
    setTestSlackAlertApiStatus(TestSlackAlertApiStatus.Loading)

    const result = await sendTestSlackAlertFromServer(params.teamId)

    switch (result.status) {
      case TestSlackAlertApiStatus.Error:
        setTestSlackAlertApiStatus(TestSlackAlertApiStatus.Error)
        toastNegative(
          `Error sending test Slack alerts`,
          result.error
        )
        break
      case TestSlackAlertApiStatus.Success:
        setTestSlackAlertApiStatus(TestSlackAlertApiStatus.Success)
        toastPositive(
          `Slack integration test alert sent successfully`
        )
        break
    }
  }

  const inviteMember = async () => {
    setInviteMemberApiStatus(InviteMemberApiStatus.Loading)

    const result = await inviteMemberFromServer(params.teamId, inviteMemberEmail, inviteMemberRole)

    switch (result.status) {
      case InviteMemberApiStatus.Error:
        setInviteMemberApiStatus(InviteMemberApiStatus.Error)
        toastNegative("Error inviting member", result.error)
        break
      case InviteMemberApiStatus.Success:
        setInviteMemberApiStatus(InviteMemberApiStatus.Success)
        toastPositive(inviteMemberEmail + " has been invited")
        setInviteMemberEmail("")
        getAuthzAndMembers(false)
        getPendingInvites(false)
        break
    }
  }

  const removeMember = async () => {
    setRemoveMemberApiStatus(RemoveMemberApiStatus.Loading)

    const result = await removeMemberFromServer(params.teamId, removeMemberId)

    switch (result.status) {
      case RemoveMemberApiStatus.Error:
        setRemoveMemberApiStatus(RemoveMemberApiStatus.Error)
        toastNegative("Error removing member", result.error)
        break
      case RemoveMemberApiStatus.Success:
        setRemoveMemberApiStatus(RemoveMemberApiStatus.Success)
        toastPositive(removeMemberEmail + " has been removed")
        getAuthzAndMembers(false)
        break
    }
  }

  return (
    <div className="flex flex-col items-start">
      <div className="flex flex-row items-center gap-2 justify-between w-full">
        <p className="font-display text-4xl max-w-6xl text-center">Team</p>
        <CreateTeam onSuccess={(teamId) => router.push(`/${teamId}/team`)} />
      </div>

      {/* Loading message for team */}
      {teamsApiStatus === TeamsApiStatus.Loading && <LoadingSpinner />}

      {/* Error message for team fetch error */}
      {teamsApiStatus === TeamsApiStatus.Error && <p className="font-body text-sm">Error fetching team, please refresh page to try again</p>}

      {teamsApiStatus === TeamsApiStatus.Success &&
        <div className="flex flex-col items-start">

          {/* Dialog for confirming pending invite resend */}
          <DangerConfirmationDialog body={<p className="font-body">Are you sure you want to resend pending invite for <span className="font-display font-bold">{resendPendingInviteEmail}</span>?</p>} open={resendPendingInviteConfirmationDialogOpen} affirmativeText="Yes, I'm sure" cancelText="Cancel"
            onAffirmativeAction={() => {
              setResendPendingInviteConfirmationDialogOpen(false)
              resendPendingInvite()
            }}
            onCancelAction={() => setResendPendingInviteConfirmationDialogOpen(false)}
          />

          {/* Dialog for confirming pending invite removal */}
          <DangerConfirmationDialog body={<p className="font-body">Are you sure you want to remove pending invite for <span className="font-display font-bold">{removePendingInviteEmail}</span>?</p>} open={removePendingInviteConfirmationDialogOpen} affirmativeText="Yes, I'm sure" cancelText="Cancel"
            onAffirmativeAction={() => {
              setRemovePendingInviteConfirmationDialogOpen(false)
              removePendingInvite()
            }}
            onCancelAction={() => setRemovePendingInviteConfirmationDialogOpen(false)}
          />

          {/* Dialog for confirming team name change */}
          <DangerConfirmationDialog body={<p className="font-body">Are you sure you want to rename team <span className="font-display font-bold">{team!.name}</span> to <span className="font-display font-bold">{newTeamName}</span>?</p>} open={teamNameConfirmationDialogOpen} affirmativeText="Yes, I'm sure" cancelText="Cancel"
            onAffirmativeAction={() => {
              setTeamNameConfirmationDialogOpen(false)
              changeTeamName()
            }}
            onCancelAction={() => setTeamNameConfirmationDialogOpen(false)}
          />

          {/* Dialog for confirming role change */}
          <DangerConfirmationDialog body={<p className="font-body">Are you sure you want to change the role of <span className="font-display font-bold">{roleChangeMemberEmail}</span> from <span className="font-display font-bold">{roleChangeOldRole}</span> to <span className="font-display font-bold">{roleChangeNewRole}</span>?</p>} open={changeRoleConfirmationDialogOpen} affirmativeText="Yes, I'm sure" cancelText="Cancel"
            onAffirmativeAction={() => {
              setChangeRoleConfirmationDialogOpen(false)
              changeRole()
            }}
            onCancelAction={() => setChangeRoleConfirmationDialogOpen(false)}
          />

          {/* Dialog for confirming member removal */}
          <DangerConfirmationDialog body={<p className="font-body">Are you sure you want to remove <span className="font-display font-bold">{removeMemberEmail}</span> from team <span className="font-display font-bold">{team!.name}</span>?</p>} open={removeMemberConfirmationDialogOpen} affirmativeText="Yes, I'm sure" cancelText="Cancel"
            onAffirmativeAction={() => {
              setRemoveMemberConfirmationDialogOpen(false)
              removeMember()
            }}
            onCancelAction={() => setRemoveMemberConfirmationDialogOpen(false)}
          />

          {/* Dialog for confirming slack disable */}
          <DangerConfirmationDialog body={<p className="font-body">Are you sure you want to disable Slack integration for team <span className="font-display font-bold">{team!.name}</span>?<br /><br />This will stop all Slack notifications for this team.</p>} open={disableSlackConfirmationDialogOpen} affirmativeText="Yes, I'm sure" cancelText="Cancel"
            onAffirmativeAction={() => {
              setDisableSlackConfirmationDialogOpen(false)
              updateSlackStatus(false)
            }}
            onCancelAction={() => setDisableSlackConfirmationDialogOpen(false)}
          />

          {/* Dialog for confirming test slack alert */}
          <ConfirmationDialog body={<p className="font-body">Are you sure you want to send test alert notifications?<br /><br /> This will send test messages to all subscribed alert channels in Slack. </p>} open={testSlackAlertConfirmationDialogOpen} affirmativeText="Yes, I'm sure" cancelText="Cancel"
            onAffirmativeAction={() => {
              setTestSlackAlertConfirmationDialogOpen(false)
              testSlackAlert()
            }}
            onCancelAction={() => setTestSlackAlertConfirmationDialogOpen(false)}
          />

          <div className="py-6" />
          <p className="font-display text-xl max-w-6xl text-center">Invite Team Members</p>
          <div className="flex flex-row items-center">
            <Input id="invite-email-input" name="invite-email-input" type="email" placeholder="Enter email" className="w-96 font-body" onInput={(e: React.ChangeEvent<HTMLInputElement>) => setInviteMemberEmail(e.target.value)} value={inviteMemberEmail} />
            <div className="px-2" />
            <DropdownSelect title="Roles" type={DropdownSelectType.SingleString} items={authzAndMembers.can_invite.map((i) => formatToCamelCase(i))} initialSelected={formatToCamelCase(authzAndMembers.can_invite[0])} onChangeSelected={(item) => setInviteMemberRole(item as string)} />
            <Button
              variant="outline"
              className="m-4"
              disabled={inviteMemberApiStatus === InviteMemberApiStatus.Loading || inviteMemberEmail === ""}
              loading={inviteMemberApiStatus === InviteMemberApiStatus.Loading}
              onClick={inviteMember}>
              Invite
            </Button>
          </div>

          <div className="py-8" />
          <p className="font-display text-xl max-w-6xl text-center">Members</p>
          <div className="py-2" />
          {/* Loading message for fetch members */}
          {getAuthzAndMembersApiStatus === AuthzAndMembersApiStatus.Loading && <LoadingSpinner />}
          {/* Error message for fetch members */}
          {getAuthzAndMembersApiStatus === AuthzAndMembersApiStatus.Error && <p className="font-body text-sm">Error fetching team members, please refresh page to try again</p>}

          {getAuthzAndMembersApiStatus === AuthzAndMembersApiStatus.Success &&
            <Table className="font-display select-none table-auto w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-96">Member</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {authzAndMembers.members.map(({ id, email, role, authz }) => (
                  <TableRow key={id} className="font-body">
                    <TableCell className="min-w-96 truncate">{email}</TableCell>

                    {/* Show only if row is current user */}
                    {id === currentUserId && (
                      <TableCell>{formatToCamelCase(role)}</TableCell>
                    )}

                    {/* Show roles dropdown if not current user */}
                    {id !== currentUserId && (
                      <TableCell>
                        {/* If roles can be changed for members, add roles to dropdown and set selected role to current role */}
                        {authz.can_change_roles !== null && authz.can_change_roles.length > 0 && (
                          <DropdownSelect
                            title="Roles"
                            type={DropdownSelectType.SingleString}
                            items={authz.can_change_roles.map((i) => formatToCamelCase(i))}
                            initialSelected={formatToCamelCase(role)}
                            onChangeSelected={(i) => {
                              const newMap = new Map(selectedDropdownRolesMap)
                              newMap.set(id, (i as string).toLocaleLowerCase())
                              setSelectedDropdownRolesMap(newMap)
                            }}
                          />
                        )}
                        {/* If roles cannot be changed for current member, just show current role as part of dropdown */}
                        {(authz.can_change_roles === null || authz.can_change_roles.length === 0) && (
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
                          disabled={selectedDropdownRolesMap.get(id) === undefined || selectedDropdownRolesMap.get(id) === role}
                          loading={roleChangeApiStatus === RoleChangeApiStatus.Loading && roleChangeMemberId === id}
                          onClick={() => {
                            setRoleChangeMemberId(id)
                            setRoleChangeMemberEmail(authzAndMembers.members.filter((i) => i.id === id)[0].email)
                            setRoleChangeOldRole(formatToCamelCase(authzAndMembers.members.filter((i) => i.id === id)[0].role))
                            setRoleChangeNewRole(selectedDropdownRolesMap.get(id) as string)
                            setChangeRoleConfirmationDialogOpen(true)
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
                          disabled={authz.can_remove === false || removeMemberApiStatus === RemoveMemberApiStatus.Loading}
                          loading={removeMemberApiStatus === RemoveMemberApiStatus.Loading && removeMemberId === id}
                          onClick={() => {
                            setRemoveMemberId(id)
                            setRemoveMemberEmail(authzAndMembers.members.filter((i) => i.id === id)[0].email)
                            setRemoveMemberConfirmationDialogOpen(true)
                          }}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>}

          {(pendingInvitesApiStatus !== PendingInvitesApiStatus.Success || (pendingInvitesApiStatus === PendingInvitesApiStatus.Success && pendingInvites?.length! > 0)) && <p className="mt-16 mb-6 font-display text-xl max-w-6xl text-center">Pending Invites</p>}
          {/* Loading message for fetch pending invites */}
          {pendingInvitesApiStatus === PendingInvitesApiStatus.Loading && <LoadingSpinner />}
          {/* Error message for fetch pending invites */}
          {pendingInvitesApiStatus === PendingInvitesApiStatus.Error && <p className="font-body text-sm">Error fetching pending invites, please refresh page to try again</p>}

          {getAuthzAndMembersApiStatus === AuthzAndMembersApiStatus.Success && pendingInvitesApiStatus === PendingInvitesApiStatus.Success && pendingInvites?.length! > 0 &&
            <Table className="font-display select-none table-auto w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-64">Invitee</TableHead>
                  <TableHead className="min-w-64">Invited By</TableHead>
                  <TableHead className="min-w-24 text-center">Invited As</TableHead>
                  <TableHead className="min-w-48 text-center">Valid Until</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvites!.map(({ id, email, invited_by_email, role, valid_until }) => (
                  <TableRow key={id} className="font-body">
                    <TableCell className="truncate" title={email}>{email}</TableCell>
                    <TableCell className="truncate" title={invited_by_email}>{invited_by_email}</TableCell>
                    <TableCell className="text-center">{formatToCamelCase(role)}</TableCell>
                    <TableCell className="text-center">{formatDateToHumanReadableDateTime(valid_until)}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        disabled={!authzAndMembers.can_invite.includes(role) || resendPendingInviteApiStatus === ResendPendingInviteApiStatus.Loading}
                        loading={resendPendingInviteApiStatus === ResendPendingInviteApiStatus.Loading && resendPendingInviteId === id}
                        onClick={() => {
                          setResendPendingInviteId(id)
                          setResendPendingInviteEmail(email)
                          setResendPendingInviteConfirmationDialogOpen(true)
                        }}>
                        Resend
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        disabled={!authzAndMembers.can_invite.includes(role) || removePendingInviteApiStatus === RemovePendingInviteApiStatus.Loading}
                        loading={removePendingInviteApiStatus === RemovePendingInviteApiStatus.Loading && removePendingInviteId === id}
                        onClick={() => {
                          setRemovePendingInviteId(id)
                          setRemovePendingInviteEmail(email)
                          setRemovePendingInviteConfirmationDialogOpen(true)
                        }}>
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>}

          <div className="py-8" />
          <p className="font-display text-xl max-w-6xl text-center">Slack Integration</p>
          <div className="py-2" />
          {(fetchTeamSlackStatusApiStatus === FetchTeamSlackStatusApiStatus.Loading || fetchTeamSlackConnectUrlApiStatus === FetchTeamSlackConnectUrlApiStatus.Loading) && <LoadingSpinner />}

          {/* error creating slack url or fetching team slack status */}
          {(fetchTeamSlackConnectUrlApiStatus === FetchTeamSlackConnectUrlApiStatus.Error || fetchTeamSlackStatusApiStatus === FetchTeamSlackStatusApiStatus.Error) &&
            <p className="font-body text-sm">Error fetching Slack Integration status. Follow our <Link target='_blank' className={underlineLinkStyle} href='https://github.com/measure-sh/measure/blob/main/docs/hosting/slack.md'>guide</Link> to set it up if you haven&apos;t done so.</p>
          }

          {/* slack not connected, show add to slack button */}
          {fetchTeamSlackConnectUrlApiStatus === FetchTeamSlackConnectUrlApiStatus.Success && fetchTeamSlackStatusApiStatus === FetchTeamSlackStatusApiStatus.Success && teamSlack === null ? <a
            href={teamSlackConnectUrl!}>
            <Image
              alt="Add to Slack"
              height={40}
              width={139}
              src="https://platform.slack-edge.com/img/add_to_slack@2x.png"
              unoptimized
            />
          </a> : ""}

          {/* slack connected, show switch */}
          {fetchTeamSlackConnectUrlApiStatus === FetchTeamSlackConnectUrlApiStatus.Success && fetchTeamSlackStatusApiStatus === FetchTeamSlackStatusApiStatus.Success && teamSlack !== null &&
            <div className="flex flex-col w-full">
              <div className="flex flex-row w-full items-center justify-between">
                <p className="font-body">Connected to <span className="font-semibold">{teamSlack.slack_team_name}</span> workspace</p>
                <Switch
                  className={"data-[state=checked]:bg-emerald-500"}
                  disabled={updateTeamSlackStatusApiStatus === UpdateTeamSlackStatusApiStatus.Loading}
                  checked={teamSlack.is_active}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      updateSlackStatus(true)
                    } else {
                      setDisableSlackConfirmationDialogOpen(true)
                    }
                  }}
                />
              </div>

              <div className="py-4" />

              <Button
                variant="outline"
                className="w-fit"
                disabled={testSlackAlertApiStatus === TestSlackAlertApiStatus.Loading || teamSlack.is_active === false}
                loading={testSlackAlertApiStatus === TestSlackAlertApiStatus.Loading}
                onClick={() => setTestSlackAlertConfirmationDialogOpen(true)}
              >
                Send Test Alert
              </Button>

            </div>
          }

          <div className="py-8" />
          <p className="font-display text-xl max-w-6xl text-center">Change Team Name</p>
          <div className="flex flex-row items-center">
            <Input id="change-team-name-input" type="text" defaultValue={team!.name}
              onChange={(event) => {
                event.target.value === team!.name ? setSaveTeamNameButtonDisabled(true) : setSaveTeamNameButtonDisabled(false)
                setNewTeamName(event.target.value)
                setTeamNameChangeApiStatus(TeamNameChangeApiStatus.Init)
              }}
              className="w-96 font-body" />
            <Button
              variant="outline"
              className="m-4"
              disabled={saveTeamNameButtonDisabled || teamNameChangeApiStatus === TeamNameChangeApiStatus.Loading}
              loading={teamNameChangeApiStatus === TeamNameChangeApiStatus.Loading}
              onClick={() => setTeamNameConfirmationDialogOpen(true)}>
              Save
            </Button>
          </div>
        </div>}
    </div>
  )
}
