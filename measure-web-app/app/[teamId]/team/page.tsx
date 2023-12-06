"use client"

import Dropdown from "@/app/components/dropdown";
import { getAccessTokenOrRedirectToAuth, logoutIfAuthError } from "@/app/utils/auth_utils";
import { useEffect, useState } from "react";
import { useRouter } from 'next/navigation';
import DangerConfirmationModal from "@/app/components/danger_confirmation_modal";

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

  enum InviteMemberApiStatus {
    Init,
    Loading,
    Success,
    Error
  }

  enum GetMembersApiStatus {
    Loading,
    Success,
    Error
  }

  const emptyTeam = { 'id': '', 'name': '' }
  const [teamsApiStatus, setTeamsApiStatus] = useState(TeamsApiStatus.Loading);
  const [team, setTeam] = useState(emptyTeam)

  const [saveTeamNameButtonDisabled, setSaveTeamNameButtonDisabled] = useState(true);

  const [teamNameConfirmationModalOpen, setTeamNameConfirmationModalOpen] = useState(false)
  const [teamNameChangeApiStatus, setteamNameChangeApiStatus] = useState(TeamNameChangeApiStatus.Init);
  const [newTeamName, setNewTeamName] = useState('')

  const [inviteMemberApiStatus, setInviteMemberApiStatus] = useState(InviteMemberApiStatus.Init);
  const [inviteMemberRole, setInviteMemberRole] = useState("Owner")
  const [inviteMemberEmail, setInviteMemberEmail] = useState("")
  const [inviteMemberErrorMsg, setInviteMemberErrorMsg] = useState("")

  const emptyMember =
  {
    "id": "",
    "name": "",
    "email": "",
    "role": "",
    "last_sign_in_at": "",
    "created_at": ""
  }
  const [getMembersApiStatus, setGetMembersApiStatus] = useState(GetMembersApiStatus.Loading);
  const [members, setMembers] = useState([] as typeof emptyMember[]);

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

  const getMembers = async () => {
    setGetMembersApiStatus(GetMembersApiStatus.Loading)

    const authToken = await getAccessTokenOrRedirectToAuth(router)
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
      headers: {
        "Authorization": `Bearer ${authToken}`
      }
    };

    const res = await fetch(`${origin}/teams/${params.teamId}/members`, opts);
    if (!res.ok) {
      setGetMembersApiStatus(GetMembersApiStatus.Error)
      logoutIfAuthError(router, res)
      return
    }

    setGetMembersApiStatus(GetMembersApiStatus.Success)
    const data = await res.json()
    setMembers(data)
  }

  useEffect(() => {
    getMembers()
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

  const inviteMember = async (email: string, role: string) => {
    setInviteMemberApiStatus(InviteMemberApiStatus.Loading)

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

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault()
    inviteMember(inviteMemberEmail as string, inviteMemberRole.toLowerCase())
  }

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
      <div className="py-4" />
      <p className="font-display font-regular text-black text-4xl max-w-6xl text-center">Team</p>
      <div className="py-4" />

      {/* Loading message for team */}
      {teamsApiStatus === TeamsApiStatus.Loading && <p className="text-lg font-display">Loading team...</p>}

      {/* Error message for team fetch error */}
      {teamsApiStatus === TeamsApiStatus.Error && <p className="text-lg font-display">Error fetching team, please refresh page to try again</p>}

      {teamsApiStatus === TeamsApiStatus.Success &&
        <div className="flex flex-col items-start">

          {/* Modal for confirming team name change */}
          <DangerConfirmationModal title="Are you sure you want to rename the team?" open={teamNameConfirmationModalOpen} affirmativeText="Yes, I'm sure" cancelText="Cancel"
            onAffirmativeAction={() => {
              setTeamNameConfirmationModalOpen(false)
              changeTeamName()
            }}
            onCancelAction={() => setTeamNameConfirmationModalOpen(false)}
          />

          <p className="font-sans text-black max-w-6xl text-center">Team name</p>
          <div className="py-1" />
          <div className="flex flex-row items-center">
            <input id="change-team-name-input" type="text" defaultValue={team.name}
              onChange={(event) => {
                event.target.value === team.name ? setSaveTeamNameButtonDisabled(true) : setSaveTeamNameButtonDisabled(false)
                setNewTeamName(event.target.value)
              }}
              className="w-96 border border-black rounded-md outline-none focus-visible:outline-yellow-300 text-black py-2 px-4 font-sans placeholder:text-neutral-400" />
            <button disabled={saveTeamNameButtonDisabled || teamNameChangeApiStatus === TeamNameChangeApiStatus.Loading} className="m-4 outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black disabled:border-gray-400 rounded-md font-display text-black disabled:text-gray-400 transition-colors duration-100 py-2 px-4" onClick={() => setTeamNameConfirmationModalOpen(true)}>Save</button>
          </div>
          {teamNameChangeApiStatus === TeamNameChangeApiStatus.Loading || teamNameChangeApiStatus === TeamNameChangeApiStatus.Error && <div className="py-1" />}
          {/* Loading message for team name change */}
          {teamNameChangeApiStatus === TeamNameChangeApiStatus.Loading && <p className="text-sm font-display">Changing team name...</p>}
          {/* Error message for team name change */}
          {teamNameChangeApiStatus === TeamNameChangeApiStatus.Error && <p className="text-sm font-display">Error changing team name, please try again</p>}

          <div className="py-4" />
          <p className="font-sans text-black max-w-6xl text-center">Invite team members</p>
          <div className="py-1" />
          <form name="invite-form" id="invite-form" autoComplete="on" onSubmit={handleInvite}>
            <div className="flex flex-row items-center">
              <input id="invite-email-input" name="invite-email-input" type="email" placeholder="Enter email" className="w-96 border border-black rounded-md outline-none focus-visible:outline-yellow-300 text-black py-2 px-4 font-sans placeholder:text-neutral-400" onInput={(e: React.ChangeEvent<HTMLInputElement>) => setInviteMemberEmail(e.target.value)} defaultValue={inviteMemberEmail} />
              <div className="px-2" />
              <Dropdown items={['Owner', 'Admin', 'Developer', 'Viewer']} onChangeSelectedItem={(item) => setInviteMemberRole(item)} initialItemIndex={0} />
              <button form="invite-form" type="submit" disabled={inviteMemberApiStatus === InviteMemberApiStatus.Loading || inviteMemberEmail === ""} className="m-4 outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black disabled:border-gray-400 rounded-md font-display text-black disabled:text-gray-400 transition-colors duration-100 py-2 px-4">Invite</button>
            </div>
          </form>
          {inviteMemberApiStatus !== InviteMemberApiStatus.Init && <div className="py-1" />}
          {/* Loading message for invite member */}
          {inviteMemberApiStatus === InviteMemberApiStatus.Loading && <p className="text-sm font-display">Inviting member...</p>}
          {/* Success message for invite member */}
          {inviteMemberApiStatus === InviteMemberApiStatus.Success && <p className="text-sm font-display">Invite link sent!</p>}
          {/* Error message for invite member */}
          {inviteMemberApiStatus === InviteMemberApiStatus.Error && <p className="text-sm font-display">${inviteMemberErrorMsg}</p>}

          <div className="py-8" />
          <p className="font-display font-regular text-black text-2xl max-w-6xl text-center">Members</p>
          <div className="py-2" />
          {/* Loading message for fetch members */}
          {getMembersApiStatus === GetMembersApiStatus.Loading && <p className="font-display">Fetching members...</p>}
          {/* Error message for fetch members */}
          {getMembersApiStatus === GetMembersApiStatus.Error && <p className="font-display">Error fetching team members, please refresh page to try again</p>}

          {getMembersApiStatus === GetMembersApiStatus.Success &&
            <div className="table-row-group">
              {members.map(({ id, email, role }) => (
                <div key={id} className="table-row font-sans text-black">
                  <div className="table-cell p-4 pl-0 text-lg">{email}</div>
                  <div className="table-cell p-4 pl-0 text-lg capitalize">{role}</div>
                </div>
              ))}
            </div>}
        </div>}
    </div>
  )
}
