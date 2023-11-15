"use client"

import Link from "next/link";
import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import TeamSwitcher from "../components/team_switcher";

const menuItems = [
    {
      href: '/dashboard/overview',
      title: 'Overview',
    },
    {
      href: '/dashboard/crashes',
      title: 'Crashes',
    },
    {
      href: '/dashboard/anrs',
      title: 'ANRs',
    },
    {
      href: '/dashboard/team',
      title: 'Team',
    },
    {
      href: '/dashboard/apps',
      title: 'Apps',
    },
  ];

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

    const [teamsApiStatus, setTeamsApiStatus] = useState(TeamsApiStatus.Loading);
    const [authToken, setAuthToken] = useState("abcde123");
    const [teams, setTeams] = useState(emptyTeams);

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
      setTeams(await res.json())
    }

    useEffect(() => {
      getTeams(authToken)
    }, [authToken]);

    const pathName = usePathname();
    const router = useRouter();

    return (
      <div>
        {/* Side nav and main content layout on normal+ size screens */}
        <div className="hidden md:flex">
            <aside className="border-black border-r sticky top-0 h-screen">
              <nav className="flex flex-col p-2 h-full w-60">
                <div className="py-4"/>
                {teamsApiStatus === TeamsApiStatus.Loading && <p className="text-lg text-center font-display">Loading teams...</p>}
                {teamsApiStatus === TeamsApiStatus.Error && <p className="text-lg text-center font-display">Error fetching teams. Please try again.</p>}
                {teamsApiStatus === TeamsApiStatus.Success && <TeamSwitcher items={teams.map((e) => e.name)}/>}
                {teamsApiStatus === TeamsApiStatus.Success && <div className="py-4"/>}
                {teamsApiStatus === TeamsApiStatus.Success &&
                  <ul>
                      {menuItems.map(({ href, title }) => (
                          <li key={title}>
                              <Link href={href} className={`m-4 outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black rounded-md font-display text-black transition-colors duration-100 py-2 px-4 ${pathName.includes(href) && 'bg-neutral-950 text-white focus-visible:text-black hover:text-black'}`}>{title}</Link>
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
                {teamsApiStatus === TeamsApiStatus.Loading && <p className="text-lg text-center font-display">Updating...</p>}
                {teamsApiStatus === TeamsApiStatus.Error && <p className="text-lg text-center font-display">Error fetching teams. Please try again.</p>}
                {teamsApiStatus === TeamsApiStatus.Success && <TeamSwitcher items={teams.map((e) => e.name)}/>}
                {teamsApiStatus === TeamsApiStatus.Success && <div className="py-4"/>}
                {teamsApiStatus === TeamsApiStatus.Success &&
                  <ul>
                      {menuItems.map(({ href, title }) => (
                          <li key={title}>
                              <Link href={href} className={`m-4 outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black rounded-md font-display text-black transition-colors duration-100 py-2 px-4 ${pathName.includes(href) && 'bg-neutral-950 text-white focus-visible:text-black hover:text-black'}`}>{title}</Link>
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