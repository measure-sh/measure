"use client"

import Link from "next/link";
import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import TeamSwitcher, { TeamsSwitcherStatus } from "../components/team_switcher";
import { TeamsApiStatus, emptyTeam, fetchTeamsFromServer } from "../api/api_calls";
import { logout } from "../utils/auth_utils";
import { auth } from "@/utils/auth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  var menuItems = [
    {
      hrefSuffix: `overview`,
      title: 'Overview',
    },
    {
      hrefSuffix: 'crashes',
      title: 'Crashes',
    },
    {
      hrefSuffix: 'anrs',
      title: 'ANRs',
    },
    {
      hrefSuffix: 'team',
      title: 'Team',
    },
    {
      hrefSuffix: 'apps',
      title: 'Apps',
    },
    // {
    //   hrefSuffix: 'alerts',
    //   title: 'Alerts',
    // },
  ];

  const [teamsApiStatus, setTeamsApiStatus] = useState(TeamsApiStatus.Loading);
  const [teams, setTeams] = useState([emptyTeam]);
  const [selectedTeam, setSelectedTeam] = useState(teams[0].id)

  const pathName = usePathname();
  const router = useRouter();

  const getTeams = async () => {
    setTeamsApiStatus(TeamsApiStatus.Loading)

    const result = await fetchTeamsFromServer(router)

    switch (result.status) {
      case TeamsApiStatus.Error:
        setTeamsApiStatus(TeamsApiStatus.Error)
        break
      case TeamsApiStatus.Success:
        setTeamsApiStatus(TeamsApiStatus.Success)
        setTeams(result.data!)
        setSelectedTeam(result.data!.find((e: { id: string, name: string }) => pathName.includes(e.id))!.id)
        break
    }
  }

  useEffect(() => {
    auth.init();
  }, [auth]);

  useEffect(() => {
    getTeams()
  }, []);

  const logoutUser = async () => {
    await logout(auth, router)
  }

  const onTeamChanged = (item: string) => {
    const selectedTeamId = teams.find((e) => e.name === item)!.id
    const newPath = pathName.replace(/^\/[^\/]*/, '/' + selectedTeamId);
    router.push(newPath)
  }

  const teamsApiStatusToTeamsSwitcherStatus = {
    [TeamsApiStatus.Loading]: TeamsSwitcherStatus.Loading,
    [TeamsApiStatus.Success]: TeamsSwitcherStatus.Success,
    [TeamsApiStatus.Error]: TeamsSwitcherStatus.Error
  };

  return (
    <div>
      {/* Side nav and main content layout on normal+ size screens */}
      <div className="md:flex selection:bg-yellow-200/75">
        <aside className="md:border-black md:border-r md:sticky md:top-0 md:h-screen">
          <nav className="flex flex-col p-2 md:h-full w-screen md:w-60">
            <div className="py-4" />
            <TeamSwitcher items={teams.map((e) => e.name)} initialItemIndex={teams.findIndex((e) => e.id === selectedTeam)} teamsSwitcherStatus={teamsApiStatusToTeamsSwitcherStatus[teamsApiStatus]} onChangeSelectedItem={(item) => onTeamChanged(item)} />
            {teamsApiStatus === TeamsApiStatus.Error && <p className="text-lg text-center font-display pt-4">Please refresh page to try again.</p>}
            {teamsApiStatus === TeamsApiStatus.Success && <div className="py-4" />}
            {teamsApiStatus === TeamsApiStatus.Success &&
              <ul>
                {menuItems.map(({ hrefSuffix, title }) => (
                  <li key={title}>
                    <Link href={`/${selectedTeam}/${hrefSuffix}`} className={`m-4 outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black rounded-md font-display transition-colors duration-100 py-2 px-4 ${pathName.includes(hrefSuffix) ? 'bg-neutral-950 text-white hover:text-black focus-visible:text-black' : ''}`}>{title}</Link>
                  </li>
                ))}
              </ul>}
            <div className="grow" />
            <button className="m-4 outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black rounded-md font-display transition-colors duration-100 py-2 px-4" onClick={() => logoutUser()}>Logout</button>
          </nav>
        </aside>
        {teamsApiStatus === TeamsApiStatus.Success && <main>{children}</main>}
      </div>
    </div>
  );
}