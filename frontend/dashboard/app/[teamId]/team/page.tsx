"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import DangerConfirmationModal from "@/app/components/danger_confirmation_dialog"
import { Team, TeamsApiStatus, fetchTeamsFromServer, AuthzAndMembersApiStatus, InviteMemberApiStatus, RemoveMemberApiStatus, RoleChangeApiStatus, TeamNameChangeApiStatus, defaultAuthzAndMembers, fetchAuthzAndMembersFromServer, changeTeamNameFromServer, changeRoleFromServer, inviteMemberFromServer, removeMemberFromServer, CreateTeamApiStatus, createTeamFromServer, PendingInvitesApiStatus, PendingInvite, fetchPendingInvitesFromServer, RemovePendingInviteApiStatus, removePendingInviteFromServer, resendPendingInviteFromServer, ResendPendingInviteApiStatus } from "@/app/api/api_calls"
import { formatToCamelCase } from "@/app/utils/string_utils"
import DropdownSelect, { DropdownSelectType } from "@/app/components/dropdown_select"
import { measureAuth } from "@/app/auth/measure_auth"
import { formatDateToHumanReadableDateTime } from "@/app/utils/time_utils"
import { Button } from "@/app/components/button"
import { toastNegative, toastPositive } from "@/app/utils/use_toast"
import LoadingSpinner from "@/app/components/loading_spinner"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/app/components/table"
import CreateTeam from "@/app/components/create_team"

export default function TeamOverview({ params }: { params: { teamId: string } }) {
  const [teamsApiStatus, setTeamsApiStatus] = useState(TeamsApiStatus.Loading)
  const [team, setTeam] = useState<Team | null>()

  const [currentUserId, setCurrentUserId] = useState<String>()

  const [saveTeamNameButtonDisabled, setSaveTeamNameButtonDisabled] = useState(true)

  const [teamNameConfirmationModalOpen, setTeamNameConfirmationModalOpen] = useState(false)
  const [teamNameChangeApiStatus, setTeamNameChangeApiStatus] = useState(TeamNameChangeApiStatus.Init)
  const [newTeamName, setNewTeamName] = useState('')

  const [inviteMemberApiStatus, setInviteMemberApiStatus] = useState(InviteMemberApiStatus.Init)
  const [inviteMemberRole, setInviteMemberRole] = useState("Owner")
  const [inviteMemberEmail, setInviteMemberEmail] = useState("")

  const [removeMemberApiStatus, setRemoveMemberApiStatus] = useState(RemoveMemberApiStatus.Init)
  const [removeMemberConfirmationModalOpen, setRemoveMemberConfirmationModalOpen] = useState(false)
  const [removeMemberId, setRemoveMemberId] = useState("")
  const [removeMemberEmail, setRemoveMemberEmail] = useState("")

  const [getAuthzAndMembersApiStatus, setAuthzAndMembersApiStatus] = useState(AuthzAndMembersApiStatus.Loading)
  const [authzAndMembers, setAuthzAndMembers] = useState(defaultAuthzAndMembers)

  const [pendingInvitesApiStatus, setPendingInvitesApiStatus] = useState(PendingInvitesApiStatus.Loading)
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[] | null>(null)

  const [resendPendingInviteConfirmationModalOpen, setResendPendingInviteConfirmationModalOpen] = useState(false)
  const [resendPendingInviteApiStatus, setResendPendingInviteApiStatus] = useState(ResendPendingInviteApiStatus.Init)
  const [resendPendingInviteId, setResendPendingInviteId] = useState("")
  const [resendPendingInviteEmail, setResendPendingInviteEmail] = useState("")

  const [removePendingInviteConfirmationModalOpen, setRemovePendingInviteConfirmationModalOpen] = useState(false)
  const [removePendingInviteApiStatus, setRemovePendingInviteApiStatus] = useState(RemovePendingInviteApiStatus.Init)
  const [removePendingInviteId, setRemovePendingInviteId] = useState("")
  const [removePendingInviteEmail, setRemovePendingInviteEmail] = useState("")

  const [selectedDropdownRolesMap, setSelectedDropdownRolesMap] = useState<Map<String, String>>(new Map())
  const [changeRoleConfirmationModalOpen, setChangeRoleConfirmationModalOpen] = useState(false)
  const [roleChangeApiStatus, setRoleChangeApiStatus] = useState(RoleChangeApiStatus.Init)
  const [roleChangeMemberId, setRoleChangeMemberId] = useState("")
  const [roleChangeMemberEmail, setRoleChangeMemberEmail] = useState("")
  const [roleChangeOldRole, setRoleChangeOldRole] = useState("")
  const [roleChangeNewRole, setRoleChangeNewRole] = useState("")

  const router = useRouter()

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
    <div className="flex flex-col selection:bg-yellow-200/75 items-start">
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

          {/* Modal for confirming pending invite resend */}
          <DangerConfirmationModal body={<p className="font-body">Are you sure you want to resend pending invite for <span className="font-display font-bold">{resendPendingInviteEmail}</span>?</p>} open={resendPendingInviteConfirmationModalOpen} affirmativeText="Yes, I'm sure" cancelText="Cancel"
            onAffirmativeAction={() => {
              setResendPendingInviteConfirmationModalOpen(false)
              resendPendingInvite()
            }}
            onCancelAction={() => setResendPendingInviteConfirmationModalOpen(false)}
          />

          {/* Modal for confirming pending invite removal */}
          <DangerConfirmationModal body={<p className="font-body">Are you sure you want to remove pending invite for <span className="font-display font-bold">{removePendingInviteEmail}</span>?</p>} open={removePendingInviteConfirmationModalOpen} affirmativeText="Yes, I'm sure" cancelText="Cancel"
            onAffirmativeAction={() => {
              setRemovePendingInviteConfirmationModalOpen(false)
              removePendingInvite()
            }}
            onCancelAction={() => setRemovePendingInviteConfirmationModalOpen(false)}
          />

          {/* Modal for confirming team name change */}
          <DangerConfirmationModal body={<p className="font-body">Are you sure you want to rename team <span className="font-display font-bold">{team!.name}</span> to <span className="font-display font-bold">{newTeamName}</span>?</p>} open={teamNameConfirmationModalOpen} affirmativeText="Yes, I'm sure" cancelText="Cancel"
            onAffirmativeAction={() => {
              setTeamNameConfirmationModalOpen(false)
              changeTeamName()
            }}
            onCancelAction={() => setTeamNameConfirmationModalOpen(false)}
          />

          {/* Modal for confirming role change */}
          <DangerConfirmationModal body={<p className="font-body">Are you sure you want to change the role of <span className="font-display font-bold">{roleChangeMemberEmail}</span> from <span className="font-display font-bold">{roleChangeOldRole}</span> to <span className="font-display font-bold">{roleChangeNewRole}</span>?</p>} open={changeRoleConfirmationModalOpen} affirmativeText="Yes, I'm sure" cancelText="Cancel"
            onAffirmativeAction={() => {
              setChangeRoleConfirmationModalOpen(false)
              changeRole()
            }}
            onCancelAction={() => setChangeRoleConfirmationModalOpen(false)}
          />

          {/* Modal for confirming member removal */}
          <DangerConfirmationModal body={<p className="font-body">Are you sure you want to remove <span className="font-display font-bold">{removeMemberEmail}</span> from team <span className="font-display font-bold">{team!.name}</span>?</p>} open={removeMemberConfirmationModalOpen} affirmativeText="Yes, I'm sure" cancelText="Cancel"
            onAffirmativeAction={() => {
              setRemoveMemberConfirmationModalOpen(false)
              removeMember()
            }}
            onCancelAction={() => setRemoveMemberConfirmationModalOpen(false)}
          />

          <div className="py-6" />
          <p className="font-display text-xl max-w-6xl text-center">Invite team members</p>
          <div className="flex flex-row items-center">
            <input id="invite-email-input" name="invite-email-input" type="email" placeholder="Enter email" className="w-96 border border-black rounded-md outline-hidden text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] py-2 px-4 font-body placeholder:text-neutral-400" onInput={(e: React.ChangeEvent<HTMLInputElement>) => setInviteMemberEmail(e.target.value)} value={inviteMemberEmail} />
            <div className="px-2" />
            <DropdownSelect title="Roles" type={DropdownSelectType.SingleString} items={authzAndMembers.can_invite.map((i) => formatToCamelCase(i))} initialSelected={formatToCamelCase(authzAndMembers.can_invite[0])} onChangeSelected={(item) => setInviteMemberRole(item as string)} />
            <Button
              variant="outline"
              className="m-4 font-display border border-black select-none"
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
            <Table className="font-display table-auto w-full">
              <TableHeader>
                <TableRow className="hover:bg-white">
                  <TableHead className="min-w-96 select-none">Member</TableHead>
                  <TableHead className="select-none">Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {authzAndMembers.members.map(({ id, email, role, authz }) => (
                  <TableRow key={id} className="font-body hover:bg-white">
                    <TableCell className="min-w-96 truncate">{email}</TableCell>

                    {/* Show only if row is current user */}
                    {id === currentUserId && (
                      <TableCell className="select-none">{formatToCamelCase(role)}</TableCell>
                    )}

                    {/* Show roles dropdown if not current user */}
                    {id !== currentUserId && (
                      <TableCell className="select-none">
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
                          className="font-display border border-black select-none"
                          disabled={selectedDropdownRolesMap.get(id) === undefined || selectedDropdownRolesMap.get(id) === role}
                          loading={roleChangeApiStatus === RoleChangeApiStatus.Loading && roleChangeMemberId === id}
                          onClick={() => {
                            setRoleChangeMemberId(id)
                            setRoleChangeMemberEmail(authzAndMembers.members.filter((i) => i.id === id)[0].email)
                            setRoleChangeOldRole(formatToCamelCase(authzAndMembers.members.filter((i) => i.id === id)[0].role))
                            setRoleChangeNewRole(selectedDropdownRolesMap.get(id) as string)
                            setChangeRoleConfirmationModalOpen(true)
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
                          className="font-display border border-black select-none"
                          disabled={authz.can_remove === false || removeMemberApiStatus === RemoveMemberApiStatus.Loading}
                          loading={removeMemberApiStatus === RemoveMemberApiStatus.Loading && removeMemberId === id}
                          onClick={() => {
                            setRemoveMemberId(id)
                            setRemoveMemberEmail(authzAndMembers.members.filter((i) => i.id === id)[0].email)
                            setRemoveMemberConfirmationModalOpen(true)
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
            <Table className="font-display table-auto w-full">
              <TableHeader>
                <TableRow className="hover:bg-white">
                  <TableHead className="min-w-64 select-none">Invitee</TableHead>
                  <TableHead className="min-w-64 select-none">Invited By</TableHead>
                  <TableHead className="min-w-24 select-none text-center">Invited As</TableHead>
                  <TableHead className="min-w-48 select-none text-center">Valid Until</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvites!.map(({ id, email, invited_by_email, role, valid_until }) => (
                  <TableRow key={id} className="hover:bg-white font-body">
                    <TableCell className="truncate" title={email}>{email}</TableCell>
                    <TableCell className="truncate" title={invited_by_email}>{invited_by_email}</TableCell>
                    <TableCell className="select-none text-center">{formatToCamelCase(role)}</TableCell>
                    <TableCell className="select-none text-center">{formatDateToHumanReadableDateTime(valid_until)}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        className="m-4 font-display border border-black select-none"
                        disabled={!authzAndMembers.can_invite.includes(role) || resendPendingInviteApiStatus === ResendPendingInviteApiStatus.Loading}
                        loading={resendPendingInviteApiStatus === ResendPendingInviteApiStatus.Loading && resendPendingInviteId === id}
                        onClick={() => {
                          setResendPendingInviteId(id)
                          setResendPendingInviteEmail(email)
                          setResendPendingInviteConfirmationModalOpen(true)
                        }}>
                        Resend
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        className="m-4 font-display border border-black select-none"
                        disabled={!authzAndMembers.can_invite.includes(role) || removePendingInviteApiStatus === RemovePendingInviteApiStatus.Loading}
                        loading={removePendingInviteApiStatus === RemovePendingInviteApiStatus.Loading && removePendingInviteId === id}
                        onClick={() => {
                          setRemovePendingInviteId(id)
                          setRemovePendingInviteEmail(email)
                          setRemovePendingInviteConfirmationModalOpen(true)
                        }}>
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>}

          <div className="py-8" />
          <p className="font-display text-xl max-w-6xl text-center">Change team name</p>
          <div className="flex flex-row items-center">
            <input id="change-team-name-input" type="text" defaultValue={team!.name}
              onChange={(event) => {
                event.target.value === team!.name ? setSaveTeamNameButtonDisabled(true) : setSaveTeamNameButtonDisabled(false)
                setNewTeamName(event.target.value)
                setTeamNameChangeApiStatus(TeamNameChangeApiStatus.Init)
              }}
              className="w-96 border border-black rounded-md outline-hidden text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] py-2 px-4 font-body placeholder:text-neutral-400" />
            <Button
              variant="outline"
              className="m-4 font-display border border-black select-none"
              disabled={saveTeamNameButtonDisabled || teamNameChangeApiStatus === TeamNameChangeApiStatus.Loading}
              loading={teamNameChangeApiStatus === TeamNameChangeApiStatus.Loading}
              onClick={() => setTeamNameConfirmationModalOpen(true)}>
              Save
            </Button>
          </div>
        </div>}
    </div>
  )
}
