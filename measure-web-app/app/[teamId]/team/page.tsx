"use client"

import Dropdown from "@/app/components/dropdown";
import { getAccessTokenOrRedirectToAuth, logoutIfAuthError } from "@/app/utils/auth_utils";
import { useEffect, useState } from "react";
import { useRouter } from 'next/navigation';


const getSelectedTeam = () => {
  const { pathname } = new URL(document.location.href)
  const fragments = pathname.split("/").filter(e => Boolean(e))
  if (!fragments.length) return null
  if (fragments.at(1) !== "team") return null
  return fragments.at(0)
}

async function inviteMember(email: string, teamId: string, role: string) {
  const res = await fetch("/auth/invite", {
    method: "post",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, teamId, role })
  })
  const json = await res.json()
  if (!res.ok) {
    alert(json.error)
    return
  }
  alert(json.ok)
}

const teamMembers = [
  {
    id: 'asldkfjlk34343',
    email: 'anup@measure.sh'
  },
  {
    id: 'sldfkjsklf898',
    email: 'gandharva@measure.sh'
  },
  {
    id: 'asafdasfd9900',
    email: 'debjeet@measure.sh'
  },
  {
    id: 'bnflkjfg8989',
    email: 'abhay@measure.sh'
  },
  {
    id: 'cbcmvncmvn89898',
    email: 'vinu@measure.sh'
  },
  {
    id: 'sldkjkjdf8989',
    email: 'adwin@measure.sh'
  },
  {
    id: 'sbxcbvcv898',
    email: 'aakash@measure.sh'
  },
  {
    id: 'asdfsdgsdg90909',
    email: 'tarun@measure.sh'
  },
  {
    id: 'ckvjdfsfjh78aswe',
    email: 'abhinav@measure.sh'
  }
];

export default function Team({ params }: { params: { teamId: string } }) {

  enum TeamsApiStatus {
    Loading,
    Success,
    Error
  }
  const emptyTeam = { 'id': '', 'name': '' }
  const [teamsApiStatus, setTeamsApiStatus] = useState(TeamsApiStatus.Loading);
  const [team, setTeam] = useState(emptyTeam)

  const [saveTeamNameButtonDisabled, setSaveTeamNameButtonDisabled] = useState(true);
  const [role, setRole] = useState("Owner")
  const [email, setEmail] = useState<string>()

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

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault()
    const teamId = getSelectedTeam()
    inviteMember(email as string, teamId as string, role.toLowerCase())
    setEmail(() => "")
  }

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
      <div className="py-4" />
      <p className="font-display font-regular text-black text-4xl max-w-6xl text-center">Team</p>
      <div className="py-4" />

      {/* Loading message for team */}
      {teamsApiStatus === TeamsApiStatus.Loading && <p className="text-lg font-display">Loading team...</p>}

      {/* Error message for tean fetch error */}
      {teamsApiStatus === TeamsApiStatus.Error && <p className="text-lg font-display">Error fetching team, please refresh page to try again</p>}

      {teamsApiStatus === TeamsApiStatus.Success &&
        <div className="flex flex-col items-start">
          <p className="font-sans text-black max-w-6xl text-center">Team name</p>
          <div className="py-1" />
          <div className="flex flex-row items-center">
            <input id="change-team-name-input" type="text" defaultValue={team.name} onChange={(event) => event.target.value === team.name ? setSaveTeamNameButtonDisabled(true) : setSaveTeamNameButtonDisabled(false)} className="w-96 border border-black rounded-md outline-none focus-visible:outline-yellow-300 text-black py-2 px-4 font-sans placeholder:text-neutral-400" />
            <button disabled={saveTeamNameButtonDisabled} className="m-4 outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black disabled:border-gray-400 rounded-md font-display text-black disabled:text-gray-400 transition-colors duration-100 py-2 px-4">Save</button>
          </div>
          <div className="py-4" />
          <p className="font-sans text-black max-w-6xl text-center">Invite team members</p>
          <div className="py-1" />
          <form name="invite-form" id="invite-form" autoComplete="on" onSubmit={handleInvite}>
            <div className="flex flex-row items-center">
              <input id="invite-email-input" name="invite-email-input" type="text" placeholder="Enter email" className="w-96 border border-black rounded-md outline-none focus-visible:outline-yellow-300 text-black py-2 px-4 font-sans placeholder:text-neutral-400" onInput={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} defaultValue={email} />
              <div className="px-2" />
              <Dropdown items={['Owner', 'Admin', 'Developer', 'Viewer']} onChangeSelectedItem={(item) => setRole(item)} initialItemIndex={0} />
              <button form="invite-form" type="submit" className="m-4 outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black rounded-md font-display text-black transition-colors duration-100 py-2 px-4">Invite</button>
            </div>
          </form>
          <div className="py-8" />
          <p className="font-display font-regular text-black text-2xl max-w-6xl text-center">Members</p>
          <div className="py-2" />
          <div className="table-row-group">
            {teamMembers.map(({ id, email }) => (
              <div key={id} className="table-row font-sans text-black">
                <div className="table-cell p-4 pl-0 text-lg">{email}</div>
                <div className="table-cell p-4 w-52"><Dropdown items={['Owner', 'Admin', 'Developer', 'Viewer']} /></div>
                <div className="table-cell p-4"><button className="m-4 outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black rounded-md font-display text-black transition-colors duration-100 py-2 px-4">Remove</button></div>
              </div>
            ))}
          </div>
        </div>}
    </div>
  )
}
