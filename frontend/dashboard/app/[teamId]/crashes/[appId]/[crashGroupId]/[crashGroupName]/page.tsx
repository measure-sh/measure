"use client"

import React from 'react'
import { ExceptionsType } from '@/app/api/api_calls'
import { ExceptionsDetails } from '@/app/components/exceptions_details'

export default function CrashGroupDetails({ params }: { params: { teamId: string, appId: string, crashGroupId: string, crashGroupName: string } }) {
  return (
    <ExceptionsDetails exceptionsType={ExceptionsType.Crash} teamId={params.teamId} appId={params.appId} exceptionsGroupId={params.crashGroupId} exceptionsGroupName={params.crashGroupName} />
  )
}