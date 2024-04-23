"use client"

import Link from "next/link";
import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import TeamSwitcher from "../components/team_switcher";
import { TeamsApiStatus, emptyTeam, fetchTeamsFromServer } from "../api/api_calls";
import { logout } from "../utils/auth_utils";
import { supabase } from "@/utils/supabase/browser";

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
    {
      hrefSuffix: 'alerts',
      title: 'Alerts',
    },
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
    getTeams()
  }, []);

  const logoutUser = async () => {
    await logout(supabase, router)
  }

  const onTeamChanged = (item: string) => {
    const selectedTeamId = teams.find((e) => e.name === item)!.id
    const newPath = pathName.replace(/^\/[^\/]*/, '/' + selectedTeamId);
    router.push(newPath)
  }

  return (
    <div>
      {/* Side nav and main content layout on normal+ size screens */}
      <div className="hidden md:flex selection:bg-yellow-200/75">
        <aside className="border-black border-r sticky top-0 h-screen">
          <nav className="flex flex-col p-2 h-full w-60">
            <div className="py-4" />
            <TeamSwitcher items={teams.map((e) => e.name)} initialItemIndex={teams.findIndex((e) => e.id === selectedTeam)} teamsApiStatus={teamsApiStatus} onChangeSelectedItem={(item) => onTeamChanged(item)} />
            {teamsApiStatus === TeamsApiStatus.Error && <p className="text-lg text-center font-display pt-4">Please refresh page to try again.</p>}
            {teamsApiStatus === TeamsApiStatus.Success && <div className="py-4" />}
            {teamsApiStatus === TeamsApiStatus.Success &&
              <ul>
                {menuItems.map(({ hrefSuffix, title }) => (
                  <li key={title}>
                    {!pathName.includes(hrefSuffix) && <Link href={`/${selectedTeam}/${hrefSuffix}`} className="m-4 outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black rounded-md font-display transition-colors duration-100 py-2 px-4">{title}</Link>}
                    {pathName.includes(hrefSuffix) && <div className="m-4 outline-none flex justify-center border border-black rounded-md font-display py-2 px-4 bg-neutral-950 text-white">{title}</div>}
                  </li>
                ))}
              </ul>}
            <div className="grow" />
            <button className="m-4 mt-8 outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200  border border-black rounded-md font-display transition-colors duration-100 py-2 px-4" onClick={() => logoutUser()}>Logout</button>
          </nav>
        </aside>
        {teamsApiStatus === TeamsApiStatus.Success && <main>{children}</main>}
      </div>

      {/* Side nav and main content layout on small screens */}
      <div className="flex flex-col md:hidden selection:bg-yellow-200/75">
        <aside>
          <nav className="flex flex-col p-2 h-full w-screen">
            <div className="py-4" />
            <TeamSwitcher items={teams.map((e) => e.name)} initialItemIndex={teams.findIndex((e) => e.id === selectedTeam)} teamsApiStatus={teamsApiStatus} onChangeSelectedItem={(item) => onTeamChanged(item)} />
            {teamsApiStatus === TeamsApiStatus.Error && <p className="text-lg text-center font-display pt-4">Please refresh page to try again.</p>}
            {teamsApiStatus === TeamsApiStatus.Success && <div className="py-4" />}
            {teamsApiStatus === TeamsApiStatus.Success &&
              <ul>
                {menuItems.map(({ hrefSuffix, title }) => (
                  <li key={title}>
                    {!pathName.includes(hrefSuffix) && <Link href={`/${selectedTeam}/${hrefSuffix}`} className="m-4 outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black rounded-md font-display transition-colors duration-100 py-2 px-4">{title}</Link>}
                    {pathName.includes(hrefSuffix) && <div className="m-4 outline-none flex justify-center border border-black rounded-md font-display py-2 px-4 bg-neutral-950 text-white">{title}</div>}
                  </li>
                ))}
              </ul>}
            <div className="grow" />
            <button className="m-4 mt-8 outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200  border border-black rounded-md font-display transition-colors duration-100 py-2 px-4" onClick={() => logoutUser()}>Logout</button>
          </nav>
        </aside>
        {teamsApiStatus === TeamsApiStatus.Success && <main>{children}</main>}
      </div>
    </div>
  );
}