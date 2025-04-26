"use client"

import Link from "next/link"
import Image from 'next/image'
import React, { useState, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import TeamSwitcher, { TeamsSwitcherStatus } from "../components/team_switcher"
import { Team, TeamsApiStatus, fetchTeamsFromServer } from "../api/api_calls"
import { measureAuth } from "../auth/measure_auth"

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
      hrefSuffix: 'traces',
      title: 'Traces',
    },
    {
      hrefSuffix: 'sessions',
      title: 'Sessions',
    },
    {
      hrefSuffix: 'bug_reports',
      title: 'Bug Reports',
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
      hrefSuffix: 'usage',
      title: 'Usage',
    },
    // {
    //   hrefSuffix: 'alerts',
    //   title: 'Alerts',
    // },
  ]

  useEffect(() => {
    measureAuth.init(router)
  }, [])

  const [teamsApiStatus, setTeamsApiStatus] = useState(TeamsApiStatus.Loading)
  const [teams, setTeams] = useState<Team[] | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)

  const pathName = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentQuery = searchParams.toString()

  const getTeams = async () => {
    setTeamsApiStatus(TeamsApiStatus.Loading)

    const result = await fetchTeamsFromServer()

    switch (result.status) {
      case TeamsApiStatus.Error:
        setTeamsApiStatus(TeamsApiStatus.Error)
        break
      case TeamsApiStatus.Success:
        setTeamsApiStatus(TeamsApiStatus.Success)
        setTeams(result.data!)
        setSelectedTeam(result.data!.find((e: { id: string, name: string }) => pathName.includes(e.id))!)
        break
    }
  }


  useEffect(() => {
    getTeams()
  }, [])

  const logoutUser = async () => {
    await measureAuth.signout()
  }

  const onTeamChanged = (item: Team) => {
    const selectedTeam = teams!.find((e) => e.id === item.id)!
    const newPath = pathName.replace(/^\/[^\/]*/, '/' + selectedTeam.id)
    router.push(newPath)
  }

  const teamsApiStatusToTeamsSwitcherStatus = {
    [TeamsApiStatus.Loading]: TeamsSwitcherStatus.Loading,
    [TeamsApiStatus.Success]: TeamsSwitcherStatus.Success,
    [TeamsApiStatus.Error]: TeamsSwitcherStatus.Error,
    [TeamsApiStatus.Cancelled]: TeamsSwitcherStatus.Loading
  }

  return (
    <div>
      {/* Side nav and main content layout on normal+ size screens */}
      <div className="md:flex selection:bg-yellow-200/75">
        <aside className="md:border-black md:border-r md:sticky md:top-0 md:h-screen">
          <nav className="flex flex-col p-2 md:h-full w-screen md:w-60">
            <div className="py-4" />
            <TeamSwitcher items={teams} initialItemIndex={teams?.findIndex((e) => e.id === selectedTeam!.id)} teamsSwitcherStatus={teamsApiStatusToTeamsSwitcherStatus[teamsApiStatus]} onChangeSelectedItem={(item) => onTeamChanged(item)} />
            {teamsApiStatus === TeamsApiStatus.Error && <p className="text-lg text-center font-display pt-4">Please refresh page to try again.</p>}
            {teamsApiStatus === TeamsApiStatus.Success && <div className="py-4" />}
            {teamsApiStatus === TeamsApiStatus.Success &&
              <ul>
                {menuItems.map(({ hrefSuffix, title }) => (
                  <li key={title}>
                    <Link href={`/${selectedTeam?.id}/${hrefSuffix}` + (currentQuery != '' && pathName.includes(hrefSuffix) ? '?' + currentQuery : '')} className={`mx-4 mb-3 outline-hidden flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black rounded-md font-display transition-colors duration-100 py-2 px-4 ${pathName.includes(hrefSuffix) ? 'bg-neutral-950 text-white hover:text-black focus-visible:text-black' : ''}`}>{title}</Link>
                  </li>
                ))}
              </ul>}
            <div className="grow" />
            <a href="https://discord.gg/f6zGkBCt42" target="_blank" className='mx-4 mb-3 outline-hidden flex flex-row justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black rounded-md font-display transition-colors duration-100 py-2 px-4'>
              <Image
                src='/images/discord_logo.svg'
                width={24}
                height={24}
                alt={'Discord logo'} />
              <div className='px-1' />
              <p className='mt-1'>Support</p>
            </a>
            <button className="mx-4 mb-2 outline-hidden flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black rounded-md font-display transition-colors duration-100 py-2 px-4" onClick={() => logoutUser()}>Logout</button>
          </nav>
        </aside>
        {teamsApiStatus === TeamsApiStatus.Success && <main className="md:overflow-auto">{children}</main>}
      </div>
    </div>
  )
}