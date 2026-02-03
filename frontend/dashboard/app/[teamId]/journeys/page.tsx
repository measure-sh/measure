"use client"

import UserJourneys from "@/app/components/user_journeys"

interface PageProps {
  params: { teamId: string }
}

export default function UserJourneysPage({ params }: PageProps) {
  return <UserJourneys params={params} />
}