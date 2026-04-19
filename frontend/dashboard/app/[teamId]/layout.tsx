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
import { useTeamsQuery } from "@/app/query/hooks"
import { usePathname, useRouter } from "next/navigation"
import React, { useEffect, useMemo, useState } from "react"
import { Team } from "../api/api_calls"
import { Skeleton } from "../components/skeleton"
import TeamSwitcher, { TeamsSwitcherStatus } from "../components/team_switcher"
import { ThemeToggle } from "../components/theme_toggle"
import UsageThresholdBanner from "../components/usage_threshold_banner"
import UserAvatar from "../components/user_avatar"
import { useMeasureStoreRegistry } from "../stores/provider"
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
          title: "Notifications",
          url: "notif_prefs",
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
  const registry = useMeasureStoreRegistry()
  const { data: teams, status: teamsStatus } = useTeamsQuery()
  const [navData, setNavData] = useState(initNavData)

  const pathName = usePathname()
  const router = useRouter()

  const selectedTeam = useMemo(() => {
    if (!teams) {
      return null
    }
    const teamId = pathName.split("/")[1]
    return teams.find((e) => e.id === teamId) ?? teams[0] ?? null
  }, [teams, pathName])

  useEffect(() => {
    registry.sessionStore.getState().init(router)
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
    await registry.sessionStore.getState().signOut()
  }

  const onTeamChanged = (item: Team) => {
    // Reset the filters store before navigating so the new page doesn't
    // mount with stale filters.ready=true from the previous team. Without
    // this, Zustand's useSyncExternalStore triggers re-renders during the
    // React transition, aborting the in-flight RSC fetch and crashing.
    registry.filtersStore.getState().reset(true)
    const newPath = `/${item.id}/overview`
    router.push(newPath)
  }

  const teamsStatusToTeamsSwitcherStatus: Record<string, TeamsSwitcherStatus> = {
    pending: TeamsSwitcherStatus.Loading,
    success: TeamsSwitcherStatus.Success,
    error: TeamsSwitcherStatus.Error,
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
                items={teams ?? null}
                initialItemIndex={teams?.findIndex(
                  (e) => e.id === selectedTeam?.id,
                )}
                teamsSwitcherStatus={
                  teamsStatusToTeamsSwitcherStatus[teamsStatus]
                }
                onChangeSelectedItem={(item) => onTeamChanged(item)}
              />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu className="gap-2">
              {teamsStatus === 'pending' &&
                initNavData.navMain.map((section) => (
                  <SidebarMenuItem key={section.title}>
                    <Skeleton className="h-7 w-24 mb-2" />
                    <SidebarMenuSub className="ml-0 border-l-0 px-1.5 gap-3">
                      {section.items.map((item) => (
                        <SidebarMenuSubItem key={item.title}>
                          <SidebarMenuSubButton asChild>
                            <Skeleton className="h-5 w-full" />
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </SidebarMenuItem>
                ))
              }
              {teamsStatus === 'error' && (
                <span className="ml-2 text-xs font-body">
                  Error fetching teams. Please refresh page to try again.
                </span>
              )}
              {teamsStatus === 'success' &&
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
              {teamsStatus === 'pending' ? (
                <div className="flex flex-row items-center w-full p-1 gap-2">
                  <Skeleton className="w-12 h-12 rounded-full shrink-0" />
                  <div className="flex flex-col gap-1 flex-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ) : (
                <UserAvatar onLogoutClick={() => logoutUser()} />
              )}
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

        {selectedTeam && <UsageThresholdBanner teamId={selectedTeam.id} />}

        <main className="flex justify-center">
          <div className="w-full max-w-[1100px] px-4 pb-24">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
