"use client"

import Link from "next/link";
import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import TeamSwitcher from "../components/team_switcher";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {

    enum TeamsApiStatus {
      Loading,
      Success,
      Error
    }

    const emptyTeams = [{'id':'', 'name':''}]

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
    ];

    const [teamsApiStatus, setTeamsApiStatus] = useState(TeamsApiStatus.Loading);
    const [authToken, setAuthToken] = useState("abcde123");
    const [teams, setTeams] = useState(emptyTeams);
    const [selectedTeam, setSelectedTeam] = useState(teams[0].id)

    const pathName = usePathname();
    const router = useRouter();

    const getTeams = async (authToken:string) => {
      setTeamsApiStatus(TeamsApiStatus.Loading)

      const origin = "https://frosty-fog-7165.fly.dev"
      const opts = {
        headers: {
          "Authorization": `Bearer ${authToken}`
        }
      };

      const res =  await fetch(`${origin}/teams`, opts);

      if(!res.ok) {
        setTeamsApiStatus(TeamsApiStatus.Error)
        return
      }

      setTeamsApiStatus(TeamsApiStatus.Success)
      const data = await res.json()
      setTeams(data)
      setSelectedTeam(data.find((e:{id:string, name:string}) => pathName.includes(e.id)).id)
    }

    useEffect(() => {
      getTeams(authToken)
    }, [authToken]);

    const onTeamChanged = (item:string) => {
      const selectedTeamId = teams.find((e) => e.name === item)!.id
      const newPath = pathName.replace(/^\/[^\/]*/, '/' + selectedTeamId);
      router.push(newPath)
    }

    return (
      <div>
        {/* Side nav and main content layout on normal+ size screens */}
        <div className="hidden md:flex">
            <aside className="border-black border-r sticky top-0 h-screen">
              <nav className="flex flex-col p-2 h-full w-60">
                <div className="py-4"/>
                {teamsApiStatus === TeamsApiStatus.Loading && <p className="flex items-center justify-center self-center w-32 aspect-square text-xl font-display border border-black rounded-full">Updating...</p>}
                {teamsApiStatus === TeamsApiStatus.Error && <p className="flex items-center justify-center self-center w-32 aspect-square text-xl font-display border border-black rounded-full">Error</p>}
                {teamsApiStatus === TeamsApiStatus.Error && <p className="text-lg text-center font-display pt-4">Please refresh page to try again.</p>}
                {teamsApiStatus === TeamsApiStatus.Success && <TeamSwitcher items={teams.map((e) => e.name)} initialItemIndex={teams.findIndex((e) => e.id === selectedTeam)} onChangeSelectedItem={(item) => onTeamChanged(item)}/>}
                {teamsApiStatus === TeamsApiStatus.Success && <div className="py-4"/>}
                {teamsApiStatus === TeamsApiStatus.Success &&
                  <ul>
                      {menuItems.map(({ hrefSuffix, title }) => (
                          <li key={title}>
                              <Link href={`/${selectedTeam}/${hrefSuffix}`} className={`m-4 outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black rounded-md font-display text-black transition-colors duration-100 py-2 px-4 ${pathName.includes(hrefSuffix) && 'bg-neutral-950 text-white focus-visible:text-black hover:text-black'}`}>{title}</Link>
                          </li>
                      ))}
                  </ul>}
                <div className="grow"/>
                <button className="m-4 mt-8 outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200  border border-black rounded-md font-display text-black transition-colors duration-100 py-2 px-4" onClick={() => router.push('/auth/logout')}>Logout</button>
              </nav>
            </aside>
            {teamsApiStatus === TeamsApiStatus.Success && <main>{children}</main>}
        </div>

        {/* Side nav and main content layout on small screens */}
        <div className="flex flex-col md:hidden">
            <aside>
              <nav className="flex flex-col p-2 h-full w-screen">
              <div className="py-4"/>
              {teamsApiStatus === TeamsApiStatus.Loading && <p className="flex items-center justify-center self-center w-32 aspect-square text-xl font-display border border-black rounded-full">Updating...</p>}
                {teamsApiStatus === TeamsApiStatus.Error && <p className="flex items-center justify-center self-center w-32 aspect-square text-xl font-display border border-black rounded-full">Error</p>}
                {teamsApiStatus === TeamsApiStatus.Error && <p className="text-lg text-center font-display pt-4">Please refresh page to try again.</p>}
                {teamsApiStatus === TeamsApiStatus.Success && <TeamSwitcher items={teams.map((e) => e.name)} initialItemIndex={teams.findIndex((e) => e.id === selectedTeam)} onChangeSelectedItem={(item) => onTeamChanged(item)}/>}
                {teamsApiStatus === TeamsApiStatus.Success && <div className="py-4"/>}
                {teamsApiStatus === TeamsApiStatus.Success &&
                  <ul>
                      {menuItems.map(({ hrefSuffix, title }) => (
                          <li key={title}>
                              <Link href={`/${selectedTeam}/${hrefSuffix}`} className={`m-4 outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black rounded-md font-display text-black transition-colors duration-100 py-2 px-4 ${pathName.includes(hrefSuffix) && 'bg-neutral-950 text-white focus-visible:text-black hover:text-black'}`}>{title}</Link>
                          </li>
                      ))}
                  </ul>}
                <div className="grow"/>
                <button className="m-4 mt-8 outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200  border border-black rounded-md font-display text-black transition-colors duration-100 py-2 px-4" onClick={() => router.push('/auth/logout')}>Logout</button>
              </nav>
            </aside>
            {teamsApiStatus === TeamsApiStatus.Success && <main>{children}</main>}
        </div>
      </div>
    );
}