"use client"

import { FormEventHandler, useEffect, useState } from "react"
import DangerConfirmationModal from "@/app/components/danger_confirmation_modal"
import { TeamsApiStatus, fetchTeamsFromServer, emptyTeam, AuthzAndMembersApiStatus, InviteMemberApiStatus, RemoveMemberApiStatus, RoleChangeApiStatus, TeamNameChangeApiStatus, defaultAuthzAndMembers, fetchAuthzAndMembersFromServer, changeTeamNameFromServer, changeRoleFromServer, inviteMemberFromServer, removeMemberFromServer, CreateTeamApiStatus, createTeamFromServer } from "@/app/api/api_calls"
import AlertDialogModal from "@/app/components/alert_dialog_modal"
import { formatToCamelCase } from "@/app/utils/string_utils"
import DropdownSelect, { DropdownSelectType } from "@/app/components/dropdown_select"
import { measureAuth } from "@/app/auth/measure_auth"

export default function Team({ params }: { params: { teamId: string } }) {
  const [teamsApiStatus, setTeamsApiStatus] = useState(TeamsApiStatus.Loading)
  const [team, setTeam] = useState(emptyTeam)

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
    setRoleChangeApiStatus(RoleChangeApiStatus.Loading)

    const result = await changeRoleFromServer(params.teamId, roleChangeNewRole, roleChangeMemberId)

    switch (result.status) {
      case RoleChangeApiStatus.Error:
        setRoleChangeApiStatus(RoleChangeApiStatus.Error)
        setChangeRoleErrorMsg(result.error)
        break
      case RoleChangeApiStatus.Success:
        setRoleChangeApiStatus(RoleChangeApiStatus.Success)
        break
    }
  }

  const inviteMember = async () => {
    setInviteMemberApiStatus(InviteMemberApiStatus.Loading)

    const result = await inviteMemberFromServer(params.teamId, inviteMemberEmail, inviteMemberRole)

    switch (result.status) {
      case InviteMemberApiStatus.Error:
        setInviteMemberApiStatus(InviteMemberApiStatus.Error)
        setInviteMemberErrorMsg(result.error)
        break
      case InviteMemberApiStatus.Success:
        setInviteMemberApiStatus(InviteMemberApiStatus.Success)
        getAuthzAndMembers()
        break
    }
  }

  const removeMember = async () => {
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
    <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
      <div className="py-4" />
      <p className="font-display text-4xl max-w-6xl text-center">Team</p>
      <div className="py-4" />

      {/* Loading message for team */}
      {teamsApiStatus === TeamsApiStatus.Loading && <p className="text-lg font-display">Loading team...</p>}

      {/* Error message for team fetch error */}
      {teamsApiStatus === TeamsApiStatus.Error && <p className="text-lg font-display">Error fetching team, please refresh page to try again</p>}

      {teamsApiStatus === TeamsApiStatus.Success &&
        <div className="flex flex-col items-start">

          {/* Modal for confirming team name change */}
          <DangerConfirmationModal body={<p className="font-body">Are you sure you want to rename team <span className="font-display font-bold">{team.name}</span> to <span className="font-display font-bold">{newTeamName}</span>?</p>} open={teamNameConfirmationModalOpen} affirmativeText="Yes, I'm sure" cancelText="Cancel"
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
          <DangerConfirmationModal body={<p className="font-body">Are you sure you want to remove <span className="font-display font-bold">{removeMemberEmail}</span> from team <span className="font-display font-bold">{team.name}</span>?</p>} open={removeMemberConfirmationModalOpen} affirmativeText="Yes, I'm sure" cancelText="Cancel"
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
            <input id="change-team-name-input" type="text" defaultValue={team.name}
              onChange={(event) => {
                event.target.value === team.name ? setSaveTeamNameButtonDisabled(true) : setSaveTeamNameButtonDisabled(false)
                setNewTeamName(event.target.value)
                setTeamNameChangeApiStatus(TeamNameChangeApiStatus.Init)
              }}
              className="w-96 border border-black rounded-md outline-hidden focus-visible:outline-yellow-300 py-2 px-4 font-body placeholder:text-neutral-400" />
            <button disabled={saveTeamNameButtonDisabled || teamNameChangeApiStatus === TeamNameChangeApiStatus.Loading} className="m-4 outline-hidden flex justify-center hover:enabled:bg-yellow-200 active:enabled:bg-yellow-300 focus-visible:enabled:bg-yellow-200 border border-black disabled:border-gray-400 rounded-md font-display disabled:text-gray-400 transition-colors duration-100 py-2 px-4" onClick={() => setTeamNameConfirmationModalOpen(true)}>Save</button>
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
            <input id="invite-email-input" name="invite-email-input" type="email" placeholder="Enter email" className="w-96 border border-black rounded-md outline-hidden focus-visible:outline-yellow-300  py-2 px-4 font-body placeholder:text-neutral-400" onInput={(e: React.ChangeEvent<HTMLInputElement>) => setInviteMemberEmail(e.target.value)} defaultValue={inviteMemberEmail} />
            <div className="px-2" />
            <DropdownSelect title="Roles" type={DropdownSelectType.SingleString} items={authzAndMembers.can_invite.map((i) => formatToCamelCase(i))} initialSelected={formatToCamelCase(authzAndMembers.can_invite[0])} onChangeSelected={(item) => setInviteMemberRole(item as string)} />
            <button disabled={inviteMemberApiStatus === InviteMemberApiStatus.Loading || inviteMemberEmail === ""} onClick={inviteMember} className="m-4 outline-hidden flex justify-center hover:enabled:bg-yellow-200 active:enabled:bg-yellow-300 focus-visible:enabled:bg-yellow-200 border border-black disabled:border-gray-400 rounded-md font-display disabled:text-gray-400 transition-colors duration-100 py-2 px-4">Invite</button>
          </div>
          {inviteMemberApiStatus !== InviteMemberApiStatus.Init && <div className="py-1" />}
          {/* Loading message for invite member */}
          {inviteMemberApiStatus === InviteMemberApiStatus.Loading && <p className="text-sm font-display">Inviting member...</p>}
          {/* Success message for invite member */}
          {inviteMemberApiStatus === InviteMemberApiStatus.Success && <p className="text-sm font-display">Invited to team!</p>}
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
                      <button disabled={selectedDropdownRolesMap.get(id) === undefined || selectedDropdownRolesMap.get(id) === role} className="m-4 outline-hidden flex justify-center hover:enabled:bg-yellow-200 active:enabled:bg-yellow-300 focus-visible:enabled:bg-yellow-200 border border-black disabled:border-gray-400 rounded-md font-display disabled:text-gray-400 transition-colors duration-100 py-2 px-4" onClick={() => {
                        setRoleChangeMemberId(id)
                        setRoleChangeMemberEmail(authzAndMembers.members.filter((i) => i.id === id)[0].email)
                        setRoleChangeOldRole(formatToCamelCase(authzAndMembers.members.filter((i) => i.id === id)[0].role))
                        setRoleChangeNewRole(selectedDropdownRolesMap.get(id) as string)
                        setChangeRoleConfirmationModalOpen(true)
                      }}>Change Role</button>
                      {/* Loading message for role change */}
                      {roleChangeApiStatus === RoleChangeApiStatus.Loading && roleChangeMemberId === id && <p className="font-display">Changing role...</p>}
                      {/* Error message for role change */}
                      {roleChangeApiStatus === RoleChangeApiStatus.Error && roleChangeMemberId === id && <p className="font-display pl-4 w-24 text-xs">Error: {changeRoleErrorMsg}</p>}
                      {/* Success message for role change */}
                      {roleChangeApiStatus === RoleChangeApiStatus.Success && roleChangeMemberId === id && <p className="font-display text-center">Role changed!</p>}
                    </div>
                  }

                  {/* Show remove member button if not current user */}
                  {id !== currentUserId &&
                    <div className="table-cell p-4 pl-0">
                      <button disabled={authz.can_remove === false || removeMemberApiStatus === RemoveMemberApiStatus.Loading} className="m-4 outline-hidden flex justify-center hover:enabled:bg-yellow-200 active:enabled:bg-yellow-300 focus-visible:enabled:bg-yellow-200 border border-black disabled:border-gray-400 rounded-md font-display disabled:text-gray-400 transition-colors duration-100 py-2 px-4" onClick={() => {
                        setRemoveMemberId(id)
                        setRemoveMemberEmail(authzAndMembers.members.filter((i) => i.id === id)[0].email)
                        setRemoveMemberConfirmationModalOpen(true)
                      }}>Remove</button>
                      {/* Loading message for member removal */}
                      {removeMemberApiStatus === RemoveMemberApiStatus.Loading && removeMemberId === id && <p className="font-display text-center">Removing member...</p>}
                      {/* Error message for member removal */}
                      {removeMemberApiStatus === RemoveMemberApiStatus.Error && removeMemberId === id && <p className="font-display pl-4 w-24 text-xs">Error: {removeMemberErrorMsg}</p>}
                    </div>
                  }

                </div>
              ))}
            </div>}

          {/* Create new team */}
          {getAuthzAndMembersApiStatus === AuthzAndMembersApiStatus.Success &&
            <div>
              <div className="py-4" />
              <div className="w-full border border-black h-0" />
              <div className="py-8" />
              <form onSubmit={createTeam} className="flex flex-col">
                <p className="font-display text-2xl">Create new team</p>
                <div className="py-2" />
                <input id="app-name" type="string" placeholder="Enter team name" className="w-96 border border-black rounded-md outline-hidden focus-visible:outline-yellow-300 py-2 px-4 font-body placeholder:text-neutral-400" onChange={(event) => setCreateTeamName(event.target.value)} />
                <div className="py-2" />
                <button type="submit" disabled={createTeamApiStatus === CreateTeamApiStatus.Loading || createTeamName.length === 0} className={`w-fit outline-hidden hover:enabled:bg-yellow-200 focus-visible:enabled:bg-yellow-200 active:enabled:bg-yellow-300 font-display border border-black rounded-md transition-colors duration-100 py-2 px-4 ${(createTeamApiStatus === CreateTeamApiStatus.Loading) ? 'pointer-events-none' : 'pointer-events-auto'}`}>Create Team</button>
                <div className="py-2" />
              </form>
              {createTeamApiStatus === CreateTeamApiStatus.Loading && <p className="font-display">Creating team...</p>}
              {createTeamApiStatus === CreateTeamApiStatus.Error && <p className="font-display">{createTeamErrorMsg}</p>}
            </div>}
        </div>}
    </div>
  )
}
