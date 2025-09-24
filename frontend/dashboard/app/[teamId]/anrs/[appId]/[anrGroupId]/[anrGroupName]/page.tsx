"use client"

import { ExceptionsType } from '@/app/api/api_calls'
import { ExceptionsDetails } from '@/app/components/exceptions_details'

export default function AnrGroupDetails({ params }: { params: { teamId: string, appId: string, anrGroupId: string, anrGroupName: string } }) {
  return (
    <ExceptionsDetails exceptionsType={ExceptionsType.Anr} teamId={params.teamId} appId={params.appId} exceptionsGroupId={params.anrGroupId} exceptionsGroupName={params.anrGroupName} />
  )
}