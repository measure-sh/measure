"use client"

import React from 'react';
import { CrashOrAnrType } from '@/app/api/api_calls';
import { CrashOrAnrGroupDetails } from '@/app/components/crash_or_anr_group_details';

export default function AnrGroupDetails({ params }: { params: { teamId: string, appId: string, anrGroupId: string, anrGroupName: string } }) {
  return (
    <CrashOrAnrGroupDetails crashOrAnrType={CrashOrAnrType.Anr} teamId={params.teamId} appId={params.appId} crashOrAnrGroupId={params.anrGroupId} crashOrAnrGroupName={params.anrGroupName} />
  )
}