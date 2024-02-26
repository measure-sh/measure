"use client"

import React from 'react';
import { CrashesOrAnrsOverview } from '@/app/components/crashes_or_anrs_overview';
import { CrashOrAnrType } from '@/app/api/api_calls';

export default function CrashesOverview({ params }: { params: { teamId: string } }) {
  return (
    <CrashesOrAnrsOverview crashOrAnrType={CrashOrAnrType.Crash} teamId={params.teamId} />
  )
}
