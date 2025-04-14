"use client"

import React from 'react'
import { ExceptionsType } from '@/app/api/api_calls'
import { ExceptionsOverview } from '@/app/components/exceptions_overview'

export default function AnrsOverview({ params }: { params: { teamId: string } }) {
  return (
    <ExceptionsOverview exceptionsType={ExceptionsType.Anr} teamId={params.teamId} />
  )
}
