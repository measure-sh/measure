"use client"

import { ExceptionsType } from '@/app/api/api_calls'
import { ExceptionsOverview } from '@/app/components/exceptions_overview'

export default function CrashesOverview({ params }: { params: { teamId: string } }) {
  return (
    <ExceptionsOverview exceptionsType={ExceptionsType.Crash} teamId={params.teamId} />
  )
}
