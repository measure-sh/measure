"use client"

import { Separator } from "@/app/components/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/app/components/sidebar"
import { usePathname, useRouter } from "next/navigation"
import React, { useEffect, useState } from "react"
import { Team, TeamsApiStatus, fetchTeamsFromServer } from "../api/api_calls"
import { measureAuth } from "../auth/measure_auth"
import TeamSwitcher, { TeamsSwitcherStatus } from "../components/team_switcher"
import { ThemeToggle } from "../components/theme_toggle"
import UserAvatar from "../components/user_avatar"
import { isCloud } from "../utils/env_utils"

const initNavData = {
  navMain: [
    {
      title: "Dashboard",
      items: [
        {
          title: "Overview",
          url: "overview",
          isActive: false,
          external: false,
        },
        {
          title: "Session Timelines",
          url: "session_timelines",
          isActive: false,
          external: false,
        },
        {
          title: "Journeys",
          url: "journeys",
          isActive: false,
          external: false,
        },
      ],
    },
    {
      title: "Issues",
      items: [
        {
          title: "Crashes",
          url: "crashes",
          isActive: false,
          external: false,
        },
        {
          title: "ANRs",
          url: "anrs",
          isActive: false,
          external: false,
        },
        {
          title: "Bug Reports",
          url: "bug_reports",
          isActive: false,
          external: false,
        },
        {
          title: "Alerts",
          url: "alerts",
          isActive: false,
          external: false,
        },
      ],
    },
    {
      title: "Performance",
      items: [
        {
          title: "Traces",
          url: "traces",
          isActive: false,
          external: false,
        },
        {
          title: "Network",
          url: "network",
          isActive: false,
          external: false,
        },
      ],
    },
    {
      title: "Settings",
      items: [
        {
          title: "Apps",
          url: "apps",
          isActive: false,
          external: false,
        },
        {
          title: "Team",
          url: "team",
          isActive: false,
          external: false,
        },
        {
          title: isCloud() ? "Usage & Billing" : "Usage",
          url: "usage",
          isActive: false,
          external: false,
        },
        {
          title: "Support",
          url: "https://discord.gg/f6zGkBCt42",
          isActive: false,
          external: true,
        },
      ],
    },
  ],
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [teamsApiStatus, setTeamsApiStatus] = useState(TeamsApiStatus.Loading)
  const [teams, setTeams] = useState<Team[] | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [navData, setNavData] = useState(initNavData)

  const pathName = usePathname()
  const router = useRouter()

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
        const teamInPath = result.data!.find(
          (e: { id: string; name: string }) => pathName.includes(e.id),
        )
        setSelectedTeam(teamInPath ? teamInPath : result.data![0])
        break
    }
  }

  useEffect(() => {
    measureAuth.init(router)
  }, [])

  useEffect(() => {
    getTeams()
  }, [])

  useEffect(() => {
    const updatedNavData = { ...navData }
    updatedNavData.navMain.forEach((section) => {
      section.items.forEach((item) => {
        item.isActive = pathName.includes(item.url)
      })
    })
    setNavData(updatedNavData)
  }, [pathName])

  const logoutUser = async () => {
    await measureAuth.signout()
  }

  const onTeamChanged = (item: Team) => {
    const selectedTeam = teams!.find((e) => e.id === item.id)!
    const newPath = `/${selectedTeam.id}/overview`
    router.push(newPath)
  }

  const teamsApiStatusToTeamsSwitcherStatus = {
    [TeamsApiStatus.Loading]: TeamsSwitcherStatus.Loading,
    [TeamsApiStatus.Success]: TeamsSwitcherStatus.Success,
    [TeamsApiStatus.Error]: TeamsSwitcherStatus.Error,
    [TeamsApiStatus.Cancelled]: TeamsSwitcherStatus.Loading,
  }

  const handleNavClick = (url: string) => {
    const updatedNavData = { ...navData }
    updatedNavData.navMain.forEach((section) => {
      section.items.forEach((item) => {
        item.isActive = item.url === url
      })
    })
    setNavData(updatedNavData)
  }

  return (
    <SidebarProvider>
      <Sidebar variant="sidebar" className="select-none">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <TeamSwitcher
                items={teams}
                initialItemIndex={teams?.findIndex(
                  (e) => e.id === selectedTeam!.id,
                )}
                teamsSwitcherStatus={
                  teamsApiStatusToTeamsSwitcherStatus[teamsApiStatus]
                }
                onChangeSelectedItem={(item) => onTeamChanged(item)}
              />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu className="gap-2">
              {teamsApiStatus === TeamsApiStatus.Loading && (
                <span className="ml-2 text-xs font-body">Loading...</span>
              )}
              {teamsApiStatus === TeamsApiStatus.Error && (
                <span className="ml-2 text-xs font-body">
                  Error fetching teams. Please refresh page to try again.
                </span>
              )}
              {teamsApiStatus === TeamsApiStatus.Success &&
                navData.navMain.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <p className="text-lg font-display">{item.title}</p>
                    {item.items?.length ? (
                      <SidebarMenuSub className="ml-0 border-l-0 px-1.5">
                        {item.items.map((item) => (
                          <SidebarMenuSubItem key={item.title}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={item.isActive}
                            >
                              <a
                                href={
                                  item.external
                                    ? `${item.url}`
                                    : `/${selectedTeam?.id}/${item.url}`
                                }
                                className="font-body"
                                onClick={(e) => {
                                  if (!item.external) {
                                    e.preventDefault()
                                    handleNavClick(item.url)
                                    router.push(
                                      `/${selectedTeam?.id}/${item.url}`,
                                    )
                                  }
                                }}
                              >
                                {item.title}
                              </a>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    ) : null}
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <UserAvatar onLogoutClick={() => logoutUser()} />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="data-[orientation=vertical]:h-4"
          />
          <ThemeToggle />
        </header>

        <main className="md:overflow-auto flex justify-center">
          <div className="w-full max-w-[1100px] px-4 pb-24">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
