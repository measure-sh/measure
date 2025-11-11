"use client"

import Overview from "@/app/components/overview"

interface PageProps {
  params: { teamId: string }
}

export default function OverviewPage({ params }: PageProps) {
  return <Overview params={params} />
}