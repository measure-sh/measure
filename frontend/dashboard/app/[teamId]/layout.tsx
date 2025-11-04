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
import { LucideBot, LucideX } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import React, { useEffect, useState } from "react"
import { Team, TeamsApiStatus, fetchTeamsFromServer } from "../api/api_calls"
import { measureAuth } from "../auth/measure_auth"
import AIChat from "../components/ai_chat"
import { Button } from "../components/button"
import TeamSwitcher, { TeamsSwitcherStatus } from "../components/team_switcher"
import UserAvatar from "../components/user_avatar"
import { AIChatProvider, useAIChatContext } from "../context/ai_chat_context"

const initNavData = {
  navMain: [
    {
      title: "Dashboard",
      items: [
        {
          title: "Overview",
          url: "overview",
          isActive: false,
          hasAiChat: true,
          external: false,
        },
        {
          title: "Sessions",
          url: "sessions",
          isActive: false,
          hasAiChat: true,
          external: false,
        },
        {
          title: "Journeys",
          url: "journeys",
          isActive: false,
          hasAiChat: true,
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
          hasAiChat: true,
          external: false,
        },
        {
          title: "ANRs",
          url: "anrs",
          isActive: false,
          hasAiChat: true,
          external: false,
        },
        {
          title: "Bug Reports",
          url: "bug_reports",
          isActive: false,
          hasAiChat: true,
          external: false,
        },
        {
          title: "Alerts",
          url: "alerts",
          isActive: false,
          hasAiChat: true,
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
          hasAiChat: true,
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
          hasAiChat: false,
          external: false,
        },
        {
          title: "Team",
          url: "team",
          isActive: false,
          hasAiChat: false,
          external: false,
        },
        {
          title: "Usage",
          url: "usage",
          isActive: false,
          hasAiChat: false,
          external: false,
        },
        {
          title: "MCP",
          url: "mcp",
          isActive: false,
          hasAiChat: false,
          external: false,
        },
        {
          title: "Support",
          url: "https://discord.gg/f6zGkBCt42",
          isActive: false,
          hasAiChat: false,
          external: true,
        },
      ],
    },
  ],
}

function AIChatSidebar({ teamId, isChatOpen, onClose }: { teamId: string, isChatOpen: boolean, onClose: () => void }) {
  const { pageContext } = useAIChatContext()

  return (
    <aside className={`fixed right-0 top-0 h-screen w-1/3 border-l bg-white shadow-xl z-50 p-4 overflow-auto transition-transform ${isChatOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <AIChat
        teamId={teamId}
        context={pageContext}
        attachmentsEnabled={true}
        modelSelectEnabled={false}
        onClose={onClose}
      />
    </aside>
  )
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
  const [isChatOpen, setIsChatOpen] = useState(false)

  const pathName = usePathname()
  const router = useRouter()

  const currentPageHasAiChat = () => {
    return navData.navMain.some(section =>
      section.items.some(item => pathName.includes(item.url) && item.hasAiChat)
    )
  }

  const hasAiChat = currentPageHasAiChat()

  useEffect(() => {
    if (!hasAiChat) {
      setIsChatOpen(false)
    }
  }, [hasAiChat])

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
    <AIChatProvider>
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
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            {hasAiChat && <Button
              variant="outline"
              className="ml-auto p-2 font-display border border-black select-none"
              onClick={() => setIsChatOpen(!isChatOpen)}
            >
              {isChatOpen ?
                <div className='flex flex-row gap-2'><LucideX />Close AI Chat</div> :
                <div className='flex flex-row gap-2'><LucideBot />Ask Measure AI</div>}
            </Button>}
          </header>

          <div className="flex h-[calc(100vh-4rem)]">
            <main className="md:overflow-auto flex justify-center flex-1">
              <div className="w-full max-w-[1100px] px-4">{children}</div>
            </main>

            {selectedTeam && <AIChatSidebar teamId={selectedTeam.id} isChatOpen={isChatOpen && hasAiChat} onClose={() => setIsChatOpen(false)} />}
          </div>
        </SidebarInset>
      </SidebarProvider >
    </AIChatProvider>
  )
}
