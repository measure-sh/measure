"use client"

import { FormEventHandler, useEffect, useState } from "react"
import DangerConfirmationModal from "@/app/components/danger_confirmation_modal"
import { Team, TeamsApiStatus, fetchTeamsFromServer, AuthzAndMembersApiStatus, InviteMemberApiStatus, RemoveMemberApiStatus, RoleChangeApiStatus, TeamNameChangeApiStatus, defaultAuthzAndMembers, fetchAuthzAndMembersFromServer, changeTeamNameFromServer, changeRoleFromServer, inviteMemberFromServer, removeMemberFromServer, CreateTeamApiStatus, createTeamFromServer, PendingInvitesApiStatus, PendingInvite, fetchPendingInvitesFromServer, RemovePendingInviteApiStatus, removePendingInviteFromServer, resendPendingInviteFromServer, ResendPendingInviteApiStatus } from "@/app/api/api_calls"
import AlertDialogModal from "@/app/components/alert_dialog_modal"
import { formatToCamelCase } from "@/app/utils/string_utils"
import DropdownSelect, { DropdownSelectType } from "@/app/components/dropdown_select"
import { measureAuth } from "@/app/auth/measure_auth"
import { formatDateToHumanReadableDateTime } from "@/app/utils/time_utils"
import { Button } from "@/app/components/button"
import { get } from "http"

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
  const [inviteMemberErrorMsg, setInviteMemberErrorMsg] = useState("")

  const [removeMemberApiStatus, setRemoveMemberApiStatus] = useState(RemoveMemberApiStatus.Init)
  const [removeMemberConfirmationModalOpen, setRemoveMemberConfirmationModalOpen] = useState(false)
  const [removeMemberId, setRemoveMemberId] = useState("")
  const [removeMemberEmail, setRemoveMemberEmail] = useState("")
  const [removeMemberErrorMsg, setRemoveMemberErrorMsg] = useState("")

  const [createTeamApiStatus, setCreateTeamApiStatus] = useState(CreateTeamApiStatus.Init)
  const [createTeamName, setCreateTeamName] = useState("")
  const [createTeamErrorMsg, setCreateTeamErrorMsg] = useState("")
  const [createTeamAlertModalOpen, setCreateTeamAlertModalOpen] = useState(false)

  const [getAuthzAndMembersApiStatus, setAuthzAndMembersApiStatus] = useState(AuthzAndMembersApiStatus.Loading)
  const [authzAndMembers, setAuthzAndMembers] = useState(defaultAuthzAndMembers)

  const [pendingInvitesApiStatus, setPendingInvitesApiStatus] = useState(PendingInvitesApiStatus.Loading)
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[] | null>(null)

  const [resendPendingInviteConfirmationModalOpen, setResendPendingInviteConfirmationModalOpen] = useState(false)
  const [resendPendingInviteApiStatus, setResendPendingInviteApiStatus] = useState(ResendPendingInviteApiStatus.Init)
  const [resendPendingInviteId, setResendPendingInviteId] = useState("")
  const [resendPendingInviteEmail, setResendPendingInviteEmail] = useState("")
  const [resendPendingInviteSuccessMsg, setResendPendingInviteSuccessMsg] = useState("")
  const [resendPendingInviteErrorMsg, setResendPendingInviteErrorMsg] = useState("")

  const [removePendingInviteConfirmationModalOpen, setRemovePendingInviteConfirmationModalOpen] = useState(false)
  const [removePendingInviteApiStatus, setRemovePendingInviteApiStatus] = useState(RemovePendingInviteApiStatus.Init)
  const [removePendingInviteId, setRemovePendingInviteId] = useState("")
  const [removePendingInviteEmail, setRemovePendingInviteEmail] = useState("")
  const [removePendingInviteErrorMsg, setRemovePendingInviteErrorMsg] = useState("")

  const [selectedDropdownRolesMap, setSelectedDropdownRolesMap] = useState<Map<String, String>>(new Map())
  const [changeRoleConfirmationModalOpen, setChangeRoleConfirmationModalOpen] = useState(false)
  const [roleChangeApiStatus, setRoleChangeApiStatus] = useState(RoleChangeApiStatus.Init)
  const [roleChangeMemberId, setRoleChangeMemberId] = useState("")
  const [roleChangeMemberEmail, setRoleChangeMemberEmail] = useState("")
  const [roleChangeOldRole, setRoleChangeOldRole] = useState("")
  const [roleChangeNewRole, setRoleChangeNewRole] = useState("")
  const [changeRoleErrorMsg, setChangeRoleErrorMsg] = useState("")

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

  const getAuthzAndMembers = async () => {
    setAuthzAndMembersApiStatus(AuthzAndMembersApiStatus.Loading)

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
    getAuthzAndMembers()
  }, [])

  const getPendingInvites = async () => {
    setPendingInvitesApiStatus(PendingInvitesApiStatus.Loading)

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
    getPendingInvites()
  }, [])

  const resendPendingInvite = async () => {
    setResendPendingInviteSuccessMsg("")
    setResendPendingInviteErrorMsg("")
    setResendPendingInviteApiStatus(ResendPendingInviteApiStatus.Loading)

    const result = await resendPendingInviteFromServer(params.teamId, resendPendingInviteId)

    switch (result.status) {
      case ResendPendingInviteApiStatus.Error:
        setResendPendingInviteApiStatus(ResendPendingInviteApiStatus.Error)
        setResendPendingInviteErrorMsg(result.error)
        break
      case ResendPendingInviteApiStatus.Success:
        setResendPendingInviteApiStatus(ResendPendingInviteApiStatus.Success)
        setResendPendingInviteSuccessMsg("Invite Resent!")
        getPendingInvites()
        break
    }
  }

  const removePendingInvite = async () => {
    setRemovePendingInviteErrorMsg("")
    setRemovePendingInviteApiStatus(RemovePendingInviteApiStatus.Loading)

    const result = await removePendingInviteFromServer(params.teamId, removePendingInviteId)

    switch (result.status) {
      case RemovePendingInviteApiStatus.Error:
        setRemovePendingInviteApiStatus(RemovePendingInviteApiStatus.Error)
        setRemovePendingInviteErrorMsg(result.error)
        break
      case RemovePendingInviteApiStatus.Success:
        setRemovePendingInviteApiStatus(RemovePendingInviteApiStatus.Success)
        getPendingInvites()
        break
    }
  }

  const changeTeamName = async () => {
    setTeamNameChangeApiStatus(TeamNameChangeApiStatus.Loading)

    const result = await changeTeamNameFromServer(params.teamId, newTeamName)

    switch (result.status) {
      case TeamNameChangeApiStatus.Error:
        setTeamNameChangeApiStatus(TeamNameChangeApiStatus.Error)
        break
      case TeamNameChangeApiStatus.Success:
        setTeamNameChangeApiStatus(TeamNameChangeApiStatus.Success)
        location.reload()
        break
    }
  }

  const changeRole = async () => {
    setChangeRoleErrorMsg("")
    setRoleChangeApiStatus(RoleChangeApiStatus.Loading)

    const result = await changeRoleFromServer(params.teamId, roleChangeNewRole, roleChangeMemberId)

    switch (result.status) {
      case RoleChangeApiStatus.Error:
        setRoleChangeApiStatus(RoleChangeApiStatus.Error)
        setChangeRoleErrorMsg(result.error)
        break
      case RoleChangeApiStatus.Success:
        setRoleChangeApiStatus(RoleChangeApiStatus.Success)
        getAuthzAndMembers()
        break
    }
  }

  const inviteMember = async () => {
    setInviteMemberErrorMsg("")
    setInviteMemberApiStatus(InviteMemberApiStatus.Loading)

    const result = await inviteMemberFromServer(params.teamId, inviteMemberEmail, inviteMemberRole)

    switch (result.status) {
      case InviteMemberApiStatus.Error:
        setInviteMemberApiStatus(InviteMemberApiStatus.Error)
        setInviteMemberErrorMsg(result.error)
        break
      case InviteMemberApiStatus.Success:
        setInviteMemberApiStatus(InviteMemberApiStatus.Success)
        setInviteMemberEmail("")
        getAuthzAndMembers()
        getPendingInvites()
        break
    }
  }

  const removeMember = async () => {
    setRemoveMemberErrorMsg("")
    setRemoveMemberApiStatus(RemoveMemberApiStatus.Loading)

    const result = await removeMemberFromServer(params.teamId, removeMemberId)

    switch (result.status) {
      case RemoveMemberApiStatus.Error:
        setRemoveMemberApiStatus(RemoveMemberApiStatus.Error)
        setRemoveMemberErrorMsg(result.error)
        break
      case RemoveMemberApiStatus.Success:
        setRemoveMemberApiStatus(RemoveMemberApiStatus.Success)
        getAuthzAndMembers()
        break
    }
  }

  const createTeam: FormEventHandler = async (event) => {
    event.preventDefault()

    if (createTeamName === "") {
      return
    }

    setCreateTeamErrorMsg("")
    setCreateTeamApiStatus(CreateTeamApiStatus.Loading)

    const result = await createTeamFromServer(createTeamName)

    switch (result.status) {
      case CreateTeamApiStatus.Error:
        setCreateTeamApiStatus(CreateTeamApiStatus.Error)
        setCreateTeamErrorMsg(result.error)
        break
      case CreateTeamApiStatus.Success:
        setCreateTeamApiStatus(CreateTeamApiStatus.Success)
        setCreateTeamAlertModalOpen(true)
        break
    }
  }

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start">
      <p className="font-display text-4xl max-w-6xl text-center">Team</p>
      <div className="py-4" />

      {/* Loading message for team */}
      {teamsApiStatus === TeamsApiStatus.Loading && <p className="text-lg font-display">Loading team...</p>}

      {/* Error message for team fetch error */}
      {teamsApiStatus === TeamsApiStatus.Error && <p className="text-lg font-display">Error fetching team, please refresh page to try again</p>}

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

          {/* Modal for acknowledging new team creation */}
          <AlertDialogModal body={<p className="font-body">New team <span className="font-display font-bold">{createTeamName}</span> created!</p>} open={createTeamAlertModalOpen} affirmativeText="Okay"
            onAffirmativeAction={() => {
              setCreateTeamAlertModalOpen(false)
              location.reload()
            }}
          />

          <p className="font-body max-w-6xl text-center">Team name</p>
          <div className="py-1" />
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
              className="m-4 font-display border border-black rounded-md select-none"
              disabled={saveTeamNameButtonDisabled || teamNameChangeApiStatus === TeamNameChangeApiStatus.Loading}
              onClick={() => setTeamNameConfirmationModalOpen(true)}>
              Save
            </Button>
          </div>
          {teamNameChangeApiStatus === TeamNameChangeApiStatus.Loading || teamNameChangeApiStatus === TeamNameChangeApiStatus.Error && <div className="py-1" />}
          {/* Loading message for team name change */}
          {teamNameChangeApiStatus === TeamNameChangeApiStatus.Loading && <p className="text-sm font-display">Changing team name...</p>}
          {/* Error message for team name change */}
          {teamNameChangeApiStatus === TeamNameChangeApiStatus.Error && <p className="text-sm font-display">Error changing team name, please try again</p>}

          <div className="py-4" />
          <p className="font-body max-w-6xl text-center">Invite team members</p>
          <div className="py-1" />
          <div className="flex flex-row items-center">
            <input id="invite-email-input" name="invite-email-input" type="email" placeholder="Enter email" className="w-96 border border-black rounded-md outline-hidden text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] py-2 px-4 font-body placeholder:text-neutral-400" onInput={(e: React.ChangeEvent<HTMLInputElement>) => setInviteMemberEmail(e.target.value)} value={inviteMemberEmail} />
            <div className="px-2" />
            <DropdownSelect title="Roles" type={DropdownSelectType.SingleString} items={authzAndMembers.can_invite.map((i) => formatToCamelCase(i))} initialSelected={formatToCamelCase(authzAndMembers.can_invite[0])} onChangeSelected={(item) => setInviteMemberRole(item as string)} />
            <Button
              variant="outline"
              className="m-4 font-display border border-black rounded-md select-none"
              disabled={inviteMemberApiStatus === InviteMemberApiStatus.Loading || inviteMemberEmail === ""}
              onClick={inviteMember}>
              Invite
            </Button>
          </div>
          {inviteMemberApiStatus !== InviteMemberApiStatus.Init && <div className="py-1" />}
          {/* Loading message for invite member */}
          {inviteMemberApiStatus === InviteMemberApiStatus.Loading && <p className="text-sm font-display">Inviting member...</p>}
          {/* Error message for invite member */}
          {inviteMemberApiStatus === InviteMemberApiStatus.Error && <p className="text-sm font-display">{inviteMemberErrorMsg}</p>}

          <div className="py-8" />
          <p className="font-display text-2xl max-w-6xl text-center">Members</p>
          <div className="py-2" />
          {/* Loading message for fetch members */}
          {getAuthzAndMembersApiStatus === AuthzAndMembersApiStatus.Loading && <p className="font-display">Fetching members...</p>}
          {/* Error message for fetch members */}
          {getAuthzAndMembersApiStatus === AuthzAndMembersApiStatus.Error && <p className="font-display">Error fetching team members, please refresh page to try again</p>}

          {getAuthzAndMembersApiStatus === AuthzAndMembersApiStatus.Success &&
            <div className="table-row-group">
              {authzAndMembers.members.map(({ id, email, role, authz }) => (
                <div key={id} className="table-row font-body">
                  <div className="table-cell p-4 pl-0 text-lg">{email}</div>

                  {/* Show only if row is current user */}
                  {id === currentUserId && <div className="table-cell p-4 pl-0 text-lg ">{formatToCamelCase(role)}</div>}

                  {/* Show roles dropdown if not current user */}
                  {id !== currentUserId &&
                    <div className="table-cell p-4 pl-0">
                      {/* If roles can be changed for members, add roles to dropdown and set selected role to current role */}
                      {authz.can_change_roles !== null && authz.can_change_roles.length > 0 && <DropdownSelect title="Roles" type={DropdownSelectType.SingleString} items={authz.can_change_roles.map((i) => formatToCamelCase(i))} initialSelected={formatToCamelCase(role)} onChangeSelected={(i) => {
                        const newMap = new Map(selectedDropdownRolesMap)
                        newMap.set(id, (i as string).toLocaleLowerCase())
                        setSelectedDropdownRolesMap(newMap)
                      }} />}
                      {/* If roles cannot be changed for current member, just show current role as part of dropdown */}
                      {authz.can_change_roles === null || authz.can_change_roles.length === 0 && <DropdownSelect title="Current Role" type={DropdownSelectType.SingleString} items={[formatToCamelCase(role)]} initialSelected={formatToCamelCase(role)} />}
                    </div>
                  }

                  {/* Show change role button if not current user */}
                  {id !== currentUserId &&
                    <div className="table-cell p-4 pl-0">
                      <Button
                        variant="outline"
                        className="m-4 font-display border border-black rounded-md select-none"
                        disabled={selectedDropdownRolesMap.get(id) === undefined || selectedDropdownRolesMap.get(id) === role}
                        onClick={() => {
                          setRoleChangeMemberId(id)
                          setRoleChangeMemberEmail(authzAndMembers.members.filter((i) => i.id === id)[0].email)
                          setRoleChangeOldRole(formatToCamelCase(authzAndMembers.members.filter((i) => i.id === id)[0].role))
                          setRoleChangeNewRole(selectedDropdownRolesMap.get(id) as string)
                          setChangeRoleConfirmationModalOpen(true)
                        }}>
                        Change Role
                      </Button>
                      {/* Loading message for role change */}
                      {roleChangeApiStatus === RoleChangeApiStatus.Loading && roleChangeMemberId === id && <p className="font-display pl-4 w-24 text-xs" title="Changing role...">Changing role...</p>}
                      {/* Error message for role change */}
                      {roleChangeApiStatus === RoleChangeApiStatus.Error && roleChangeMemberId === id && <p className="font-display pl-4 w-24 text-xs" title={"Error: " + changeRoleErrorMsg}>Error: {changeRoleErrorMsg}</p>}
                    </div>
                  }

                  {/* Show remove member button if not current user */}
                  {id !== currentUserId &&
                    <div className="table-cell p-4 pl-0">
                      <Button
                        variant="outline"
                        className="m-4 font-display border border-black rounded-md select-none"
                        disabled={authz.can_remove === false || removeMemberApiStatus === RemoveMemberApiStatus.Loading}
                        onClick={() => {
                          setRemoveMemberId(id)
                          setRemoveMemberEmail(authzAndMembers.members.filter((i) => i.id === id)[0].email)
                          setRemoveMemberConfirmationModalOpen(true)
                        }}>
                        Remove
                      </Button>
                      {/* Loading message for member removal */}
                      {removeMemberApiStatus === RemoveMemberApiStatus.Loading && removeMemberId === id && <p className="font-display pl-4 w-24 text-xs truncate" title="Removing member...">Removing member...</p>}
                      {/* Error message for member removal */}
                      {removeMemberApiStatus === RemoveMemberApiStatus.Error && removeMemberId === id && <p className="font-display pl-4 w-24 text-xs" title={"Error: " + removeMemberErrorMsg}>Error: {removeMemberErrorMsg}</p>}
                    </div>
                  }

                </div>
              ))}
            </div>}

          {(pendingInvitesApiStatus !== PendingInvitesApiStatus.Success || (pendingInvitesApiStatus === PendingInvitesApiStatus.Success && pendingInvites?.length! > 0)) && <p className="mt-8 mb-2 font-display text-2xl max-w-6xl text-center">Pending Invites</p>}
          {/* Loading message for fetch pending invites */}
          {pendingInvitesApiStatus === PendingInvitesApiStatus.Loading && <p className="font-display">Fetching pending invites...</p>}
          {/* Error message for fetch pending invites */}
          {pendingInvitesApiStatus === PendingInvitesApiStatus.Error && <p className="font-display">Error fetching pending invites, please refresh page to try again</p>}

          {getAuthzAndMembersApiStatus === AuthzAndMembersApiStatus.Success && pendingInvitesApiStatus === PendingInvitesApiStatus.Success && pendingInvites?.length! > 0 &&
            <div className="table w-full" style={{ tableLayout: "fixed" }}>
              <div className="table-header-group bg-neutral-950">
                <div className="table-row text-white font-display">
                  <div className="table-cell w-64 p-4">Invitee</div>
                  <div className="table-cell w-64 p-4">Invited By</div>
                  <div className="table-cell w-24 p-4 text-center">Invited As</div>
                  <div className="table-cell w-48 p-4 text-center">Valid Until</div>
                  <div className="table-cell w-24 p-4 text-center" />
                  <div className="table-cell w-24 p-4 text-center" />
                </div>
              </div>
              <div className="table-row-group">
                {pendingInvites!.map(({ id, email, invited_by_email, role, valid_until }) => (
                  <div key={id} className="table-row font-body">
                    <div className="table-cell p-4 truncate" title={email}>{email}</div>
                    <div className="table-cell p-4 truncate" title={invited_by_email}>{invited_by_email}</div>
                    <div className="table-cell p-4 text-center">{formatToCamelCase(role)}</div>
                    <div className="table-cell p-4 text-center">{formatDateToHumanReadableDateTime(valid_until)}</div>
                    <div className="table-cell p-4">
                      <Button
                        variant="outline"
                        className="m-4 font-display border border-black rounded-md select-none"
                        disabled={!authzAndMembers.can_invite.includes(role) || resendPendingInviteApiStatus === ResendPendingInviteApiStatus.Loading}
                        onClick={() => {
                          setResendPendingInviteId(id)
                          setResendPendingInviteEmail(email)
                          setResendPendingInviteConfirmationModalOpen(true)
                        }}>
                        Resend
                      </Button>
                      {/* Loading message for pending invite resend */}
                      {resendPendingInviteApiStatus === ResendPendingInviteApiStatus.Loading && resendPendingInviteId === id && <p className="font-display pl-4 w-24 text-xs truncate" title="Resending pending invite...">Resending pending invite...</p>}
                      {/* Error message for pending invite resend */}
                      {resendPendingInviteApiStatus === ResendPendingInviteApiStatus.Error && resendPendingInviteId === id && <p className="font-display pl-4 w-24 text-xs truncate" title={"Error: " + resendPendingInviteErrorMsg}>Error: {resendPendingInviteErrorMsg}</p>}
                      {/* Success message for pending invite resend */}
                      {resendPendingInviteApiStatus === ResendPendingInviteApiStatus.Success && resendPendingInviteId === id && <p className="font-display pl-4 w-24 text-xs truncate" title={resendPendingInviteSuccessMsg}>{resendPendingInviteSuccessMsg}</p>}
                    </div>
                    <div className="table-cell p-4">
                      <Button
                        variant="outline"
                        className="m-4 font-display border border-black rounded-md select-none"
                        disabled={!authzAndMembers.can_invite.includes(role) || removePendingInviteApiStatus === RemovePendingInviteApiStatus.Loading}
                        onClick={() => {
                          setRemovePendingInviteId(id)
                          setRemovePendingInviteEmail(email)
                          setRemovePendingInviteConfirmationModalOpen(true)
                        }}>
                        Revoke
                      </Button>
                      {/* Loading message for pending invite removal */}
                      {removePendingInviteApiStatus === RemovePendingInviteApiStatus.Loading && removePendingInviteId === id && <p className="font-display pl-4 w-24 text-xs truncate" title="Revoking pending invite...">Revoking pending invite...</p>}
                      {/* Error message for pending invite removal */}
                      {removePendingInviteApiStatus === RemovePendingInviteApiStatus.Error && removePendingInviteId === id && <p className="font-display pl-4 w-24 text-xs truncate" title={"Error: " + removePendingInviteErrorMsg}>Error: {removePendingInviteErrorMsg}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>}

          {/* Create new team */}
          {getAuthzAndMembersApiStatus === AuthzAndMembersApiStatus.Success &&
            <div className="w-full">
              <div className="py-8" />
              <div className="w-full border border-black h-0" />
              <div className="py-4" />
              <form onSubmit={createTeam} className="flex flex-col">
                <p className="font-display text-2xl">Create new team</p>
                <div className="py-4" />
                <input id="app-name" type="string" placeholder="Enter team name" className="w-96 border border-black rounded-md outline-hidden text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] py-2 px-4 font-body placeholder:text-neutral-400" onChange={(event) => setCreateTeamName(event.target.value)} />
                <div className="py-2" />
                <Button
                  variant="outline"
                  type="submit"
                  className="w-fit font-display border border-black rounded-md select-none"
                  disabled={createTeamApiStatus === CreateTeamApiStatus.Loading || createTeamName.length === 0}>
                  Create Team
                </Button>
                <div className="py-2" />
              </form>
              {createTeamApiStatus === CreateTeamApiStatus.Loading && <p className="font-display">Creating team...</p>}
              {createTeamApiStatus === CreateTeamApiStatus.Error && <p className="font-display">{createTeamErrorMsg}</p>}
            </div>}
        </div>}
    </div>
  )
}
