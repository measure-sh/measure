"use client"

import Dropdown from "@/app/components/dropdown";
import { getAccessTokenOrRedirectToAuth, getUserIdOrRedirectToAuth, logoutIfAuthError } from "@/app/utils/auth_utils";
import { useEffect, useState } from "react";
import { useRouter } from 'next/navigation';
import DangerConfirmationModal from "@/app/components/danger_confirmation_modal";

function formatToCamelCase(role: string): string {
  return role.charAt(0).toLocaleUpperCase() + role.slice(1)
}

export default function Team({ params }: { params: { teamId: string } }) {

  enum TeamsApiStatus {
    Loading,
    Success,
    Error
  }

  enum TeamNameChangeApiStatus {
    Init,
    Loading,
    Success,
    Error
  }

  enum RoleChangeApiStatus {
    Init,
    Loading,
    Success,
    Error
  }

  enum InviteMemberApiStatus {
    Init,
    Loading,
    Success,
    Error
  }

  enum RemoveMemberApiStatus {
    Init,
    Loading,
    Success,
    Error
  }

  enum GetAuthzAndMembersApiStatus {
    Loading,
    Success,
    Error
  }

  const emptyTeam = { 'id': '', 'name': '' }
  const [teamsApiStatus, setTeamsApiStatus] = useState(TeamsApiStatus.Loading);
  const [team, setTeam] = useState(emptyTeam)

  const [currentUserId, setCurrentUserId] = useState<String>()

  const [saveTeamNameButtonDisabled, setSaveTeamNameButtonDisabled] = useState(true);

  const [teamNameConfirmationModalOpen, setTeamNameConfirmationModalOpen] = useState(false)
  const [teamNameChangeApiStatus, setteamNameChangeApiStatus] = useState(TeamNameChangeApiStatus.Init);
  const [newTeamName, setNewTeamName] = useState('')

  const [inviteMemberApiStatus, setInviteMemberApiStatus] = useState(InviteMemberApiStatus.Init);
  const [inviteMemberRole, setInviteMemberRole] = useState("Owner")
  const [inviteMemberEmail, setInviteMemberEmail] = useState("")
  const [inviteMemberErrorMsg, setInviteMemberErrorMsg] = useState("")

  const [removeMemberApiStatus, seRemoveMemberApiStatus] = useState(RemoveMemberApiStatus.Init);
  const [removeMemberConfirmationModalOpen, setRemoveMemberConfirmationModalOpen] = useState(false)
  const [removeMemberId, setRemoveMemberId] = useState("")
  const [removeMemberEmail, setRemoveMemberEmail] = useState("")
  const [removeMemberErrorMsg, setRemoveMemberErrorMsg] = useState("")

  const defaultAuthzAndMembers = {
    "can_invite": [
      "viewer"
    ],
    "members": [
      {
        "id": "",
        "name": null,
        "email": "",
        "role": "",
        "last_sign_in_at": "",
        "created_at": "",
        "authz": {
          "can_change_roles": [
            ""
          ],
          "can_remove": true
        }
      }
    ]
  }
  const [getAuthzAndMembersApiStatus, setGetAuthzAndMembersApiStatus] = useState(GetAuthzAndMembersApiStatus.Loading);
  const [authzAndMembers, setAuthzAndMembers] = useState(defaultAuthzAndMembers)
  const [selectedDropdownRolesMap, setSelectedDropdownRolesMap] = useState<Map<String, String>>(new Map())
  const [changeRoleConfirmationModalOpen, setChangeRoleConfirmationModalOpen] = useState(false)
  const [roleChangeApiStatus, setRoleChangeApiStatus] = useState(RoleChangeApiStatus.Init);
  const [roleChangeMemberId, setRoleChangeMemberId] = useState("")
  const [roleChangeMemberEmail, setRoleChangeMemberEmail] = useState("")
  const [roleChangeOldRole, setRoleChangeOldRole] = useState("")
  const [roleChangeNewRole, setRoleChangeNewRole] = useState("")
  const [changeRoleErrorMsg, setChangeRoleErrorMsg] = useState("")

  const router = useRouter();

  const getTeam = async () => {
    setTeamsApiStatus(TeamsApiStatus.Loading)

    const authToken = await getAccessTokenOrRedirectToAuth(router)
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
      headers: {
        "Authorization": `Bearer ${authToken}`
      }
    };

    const res = await fetch(`${origin}/teams`, opts);
    if (!res.ok) {
      setTeamsApiStatus(TeamsApiStatus.Error)
      logoutIfAuthError(router, res)
      return
    }

    setTeamsApiStatus(TeamsApiStatus.Success)
    const data: [{ id: string, name: string }] = await res.json()


    setTeam(data.filter((i) => i.id === params.teamId)[0])
  }

  useEffect(() => {
    getTeam()
  }, []);

  const getCurrentUserId = async () => {
    const id = await getUserIdOrRedirectToAuth(router)
    if (id !== null) {
      setCurrentUserId(id)
    }
  }

  useEffect(() => {
    getCurrentUserId()
  }, []);

  const getAuthzAndMembers = async () => {
    setGetAuthzAndMembersApiStatus(GetAuthzAndMembersApiStatus.Loading)

    const authToken = await getAccessTokenOrRedirectToAuth(router)
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
      headers: {
        "Authorization": `Bearer ${authToken}`
      }
    };

    const res = await fetch(`${origin}/teams/${params.teamId}/authz`, opts);
    if (!res.ok) {
      setGetAuthzAndMembersApiStatus(GetAuthzAndMembersApiStatus.Error)
      logoutIfAuthError(router, res)
      return
    }

    setGetAuthzAndMembersApiStatus(GetAuthzAndMembersApiStatus.Success)
    const data = await res.json()
    setAuthzAndMembers(data)
  }

  useEffect(() => {
    getAuthzAndMembers()
  }, []);

  const changeTeamName = async () => {
    setteamNameChangeApiStatus(TeamNameChangeApiStatus.Loading)

    const authToken = await getAccessTokenOrRedirectToAuth(router)
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
      method: 'PATCH',
      headers: {
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify({ name: newTeamName })
    };

    const res = await fetch(`${origin}/teams/${params.teamId}/rename`, opts);
    if (!res.ok) {
      setteamNameChangeApiStatus(TeamNameChangeApiStatus.Error)
      logoutIfAuthError(router, res)
      return
    }

    setteamNameChangeApiStatus(TeamNameChangeApiStatus.Success)
    location.reload()
  }

  const changeRole = async () => {
    setRoleChangeApiStatus(RoleChangeApiStatus.Loading)

    const authToken = await getAccessTokenOrRedirectToAuth(router)
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
      method: 'PATCH',
      headers: {
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify({ role: roleChangeNewRole.toLocaleLowerCase() })
    };

    const res = await fetch(`${origin}/teams/${params.teamId}/members/${roleChangeMemberId}/role`, opts);
    const json = await res.json()

    if (!res.ok) {
      setRoleChangeApiStatus(RoleChangeApiStatus.Error)
      setChangeRoleErrorMsg(json.error)
      logoutIfAuthError(router, res)
      return
    }

    setRoleChangeApiStatus(RoleChangeApiStatus.Success)
  }

  const inviteMember = async () => {
    setInviteMemberApiStatus(InviteMemberApiStatus.Loading)

    const email = inviteMemberEmail
    const role = inviteMemberRole.toLowerCase()
    const teamId = params.teamId
    const res = await fetch("/auth/invite", {
      method: "post",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, teamId, role })
    })
    const json = await res.json()

    if (!res.ok) {
      setInviteMemberApiStatus(InviteMemberApiStatus.Error)
      setInviteMemberErrorMsg(json.error)
      logoutIfAuthError(router, res)
      return
    }

    setInviteMemberApiStatus(InviteMemberApiStatus.Success)
  }

  const removeMember = async () => {
    seRemoveMemberApiStatus(RemoveMemberApiStatus.Loading)

    const authToken = await getAccessTokenOrRedirectToAuth(router)
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
      method: 'DELETE',
      headers: {
        "Authorization": `Bearer ${authToken}`
      },
    };

    const res = await fetch(`${origin}/teams/${params.teamId}/members/${removeMemberId}`, opts);
    const json = await res.json()

    if (!res.ok) {
      seRemoveMemberApiStatus(RemoveMemberApiStatus.Error)
      setRemoveMemberErrorMsg(json.error)
      logoutIfAuthError(router, res)
      return
    }

    seRemoveMemberApiStatus(RemoveMemberApiStatus.Success)
    getAuthzAndMembers()
  }

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
      <div className="py-4" />
      <p className="font-display font-regular text-4xl max-w-6xl text-center">Team</p>
      <div className="py-4" />

      {/* Loading message for team */}
      {teamsApiStatus === TeamsApiStatus.Loading && <p className="text-lg font-display">Loading team...</p>}

      {/* Error message for team fetch error */}
      {teamsApiStatus === TeamsApiStatus.Error && <p className="text-lg font-display">Error fetching team, please refresh page to try again</p>}

      {teamsApiStatus === TeamsApiStatus.Success &&
        <div className="flex flex-col items-start">

          {/* Modal for confirming team name change */}
          <DangerConfirmationModal body={<p className="font-sans">Are you sure you want to rename team <span className="font-display font-bold">{team.name}</span> to <span className="font-display font-bold">{newTeamName}</span>?</p>} open={teamNameConfirmationModalOpen} affirmativeText="Yes, I'm sure" cancelText="Cancel"
            onAffirmativeAction={() => {
              setTeamNameConfirmationModalOpen(false)
              changeTeamName()
            }}
            onCancelAction={() => setTeamNameConfirmationModalOpen(false)}
          />

          {/* Modal for confirming role change */}
          <DangerConfirmationModal body={<p className="font-sans">Are you sure you want to change the role of <span className="font-display font-bold">{roleChangeMemberEmail}</span> from <span className="font-display font-bold">{roleChangeOldRole}</span> to <span className="font-display font-bold">{roleChangeNewRole}</span>?</p>} open={changeRoleConfirmationModalOpen} affirmativeText="Yes, I'm sure" cancelText="Cancel"
            onAffirmativeAction={() => {
              setChangeRoleConfirmationModalOpen(false)
              changeRole()
            }}
            onCancelAction={() => setChangeRoleConfirmationModalOpen(false)}
          />

          {/* Modal for confirming member removal */}
          <DangerConfirmationModal body={<p className="font-sans">Are you sure you want to remove <span className="font-display font-bold">{removeMemberEmail}</span> from team <span className="font-display font-bold">{team.name}</span>?</p>} open={removeMemberConfirmationModalOpen} affirmativeText="Yes, I'm sure" cancelText="Cancel"
            onAffirmativeAction={() => {
              setRemoveMemberConfirmationModalOpen(false)
              removeMember()
            }}
            onCancelAction={() => setRemoveMemberConfirmationModalOpen(false)}
          />

          <p className="font-sans max-w-6xl text-center">Team name</p>
          <div className="py-1" />
          <div className="flex flex-row items-center">
            <input id="change-team-name-input" type="text" defaultValue={team.name}
              onChange={(event) => {
                event.target.value === team.name ? setSaveTeamNameButtonDisabled(true) : setSaveTeamNameButtonDisabled(false)
                setNewTeamName(event.target.value)
              }}
              className="w-96 border border-black rounded-md outline-none focus-visible:outline-yellow-300 py-2 px-4 font-sans placeholder:text-neutral-400" />
            <button disabled={saveTeamNameButtonDisabled || teamNameChangeApiStatus === TeamNameChangeApiStatus.Loading} className="m-4 outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black disabled:border-gray-400 rounded-md font-display disabled:text-gray-400 transition-colors duration-100 py-2 px-4" onClick={() => setTeamNameConfirmationModalOpen(true)}>Save</button>
          </div>
          {teamNameChangeApiStatus === TeamNameChangeApiStatus.Loading || teamNameChangeApiStatus === TeamNameChangeApiStatus.Error && <div className="py-1" />}
          {/* Loading message for team name change */}
          {teamNameChangeApiStatus === TeamNameChangeApiStatus.Loading && <p className="text-sm font-display">Changing team name...</p>}
          {/* Error message for team name change */}
          {teamNameChangeApiStatus === TeamNameChangeApiStatus.Error && <p className="text-sm font-display">Error changing team name, please try again</p>}

          <div className="py-4" />
          <p className="font-sans max-w-6xl text-center">Invite team members</p>
          <div className="py-1" />
          <div className="flex flex-row items-center">
            <input id="invite-email-input" name="invite-email-input" type="email" placeholder="Enter email" className="w-96 border border-black rounded-md outline-none focus-visible:outline-yellow-300  py-2 px-4 font-sans placeholder:text-neutral-400" onInput={(e: React.ChangeEvent<HTMLInputElement>) => setInviteMemberEmail(e.target.value)} defaultValue={inviteMemberEmail} />
            <div className="px-2" />
            <Dropdown items={authzAndMembers.can_invite.map((i) => formatToCamelCase(i))} onChangeSelectedItem={(item) => setInviteMemberRole(item)} initialItemIndex={0} />
            <button disabled={inviteMemberApiStatus === InviteMemberApiStatus.Loading || inviteMemberEmail === ""} onClick={inviteMember} className="m-4 outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black disabled:border-gray-400 rounded-md font-display disabled:text-gray-400 transition-colors duration-100 py-2 px-4">Invite</button>
          </div>
          {inviteMemberApiStatus !== InviteMemberApiStatus.Init && <div className="py-1" />}
          {/* Loading message for invite member */}
          {inviteMemberApiStatus === InviteMemberApiStatus.Loading && <p className="text-sm font-display">Inviting member...</p>}
          {/* Success message for invite member */}
          {inviteMemberApiStatus === InviteMemberApiStatus.Success && <p className="text-sm font-display">Invite link sent!</p>}
          {/* Error message for invite member */}
          {inviteMemberApiStatus === InviteMemberApiStatus.Error && <p className="text-sm font-display">{inviteMemberErrorMsg}</p>}

          <div className="py-8" />
          <p className="font-display font-regular text-2xl max-w-6xl text-center">Members</p>
          <div className="py-2" />
          {/* Loading message for fetch members */}
          {getAuthzAndMembersApiStatus === GetAuthzAndMembersApiStatus.Loading && <p className="font-display">Fetching members...</p>}
          {/* Error message for fetch members */}
          {getAuthzAndMembersApiStatus === GetAuthzAndMembersApiStatus.Error && <p className="font-display">Error fetching team members, please refresh page to try again</p>}

          {getAuthzAndMembersApiStatus === GetAuthzAndMembersApiStatus.Success &&
            <div className="table-row-group">
              {authzAndMembers.members.map(({ id, email, role, authz }) => (
                <div key={id} className="table-row font-sans">
                  <div className="table-cell p-4 pl-0 text-lg">{email}</div>

                  {/* Show only if row is current user */}
                  {id === currentUserId && <div className="table-cell p-4 pl-0 text-lg ">{formatToCamelCase(role)}</div>}

                  {/* Show roles dropdown if not current user */}
                  {id !== currentUserId &&
                    <div className="table-cell p-4 pl-0">
                      {/* If roles can be changed for members, add roles to dropdown and set selected role to current role */}
                      {authz.can_change_roles !== null && authz.can_change_roles.length > 0 && <Dropdown items={authz.can_change_roles.map((i) => formatToCamelCase(i))} initialItemIndex={authzAndMembers.can_invite.findIndex((i) => i === role)} onChangeSelectedItem={(i) => {
                        const newMap = new Map(selectedDropdownRolesMap)
                        newMap.set(id, i)
                        setSelectedDropdownRolesMap(newMap)
                      }} />}
                      {/* If roles cannot be changed for current member, just show current role as part of dropdown */}
                      {authz.can_change_roles === null || authz.can_change_roles.length === 0 && <Dropdown items={[role]} />}
                    </div>
                  }

                  {/* Show change role button if not current user */}
                  {id !== currentUserId &&
                    <div className="table-cell p-4 pl-0">
                      <button disabled={selectedDropdownRolesMap.get(id) === undefined || selectedDropdownRolesMap.get(id) === role} className="m-4 outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black disabled:border-gray-400 rounded-md font-display disabled:text-gray-400 transition-colors duration-100 py-2 px-4" onClick={() => {
                        setRoleChangeMemberId(id)
                        setRoleChangeMemberEmail(authzAndMembers.members.filter((i) => i.id === id)[0].email)
                        setRoleChangeOldRole(formatToCamelCase(authzAndMembers.members.filter((i) => i.id === id)[0].role))
                        setRoleChangeNewRole(selectedDropdownRolesMap.get(id) as string)
                        setChangeRoleConfirmationModalOpen(true)
                      }}>Change Role</button>
                      {/* Loading message for role change */}
                      {roleChangeApiStatus === RoleChangeApiStatus.Loading && roleChangeMemberId === id && <p className="font-display">Changing role...</p>}
                      {/* Error message for role change */}
                      {roleChangeApiStatus === RoleChangeApiStatus.Error && roleChangeMemberId === id && <p className="font-display text-center">Error: {changeRoleErrorMsg}</p>}
                      {/* Success message for role change */}
                      {roleChangeApiStatus === RoleChangeApiStatus.Success && roleChangeMemberId === id && <p className="font-display text-center">Role changed!</p>}
                    </div>
                  }

                  {/* Show remove member button if not current user */}
                  {id !== currentUserId &&
                    <div className="table-cell p-4 pl-0">
                      <button disabled={authz.can_remove === false || removeMemberApiStatus === RemoveMemberApiStatus.Loading} className="m-4 outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black disabled:border-gray-400 rounded-md font-display disabled:text-gray-400 transition-colors duration-100 py-2 px-4" onClick={() => {
                        setRemoveMemberId(id)
                        setRemoveMemberEmail(authzAndMembers.members.filter((i) => i.id === id)[0].email)
                        setRemoveMemberConfirmationModalOpen(true)
                      }}>Remove</button>
                      {/* Loading message for member removal */}
                      {removeMemberApiStatus === RemoveMemberApiStatus.Loading && removeMemberId === id && <p className="font-display text-center">Removing member...</p>}
                      {/* Error message for member removal */}
                      {removeMemberApiStatus === RemoveMemberApiStatus.Error && removeMemberId === id && <p className="font-display text-center">Error: {removeMemberErrorMsg}</p>}
                    </div>
                  }

                </div>
              ))}
            </div>}
        </div>}
    </div>
  )
}
