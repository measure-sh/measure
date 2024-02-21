"use client"

import React from 'react';
import { CrashOrAnrType } from '@/app/api/api_calls';
import { CrashOrAnrGroupDetails } from '@/app/components/crash_or_anr_group_details';

export default function CrashGroupDetails({ params }: { params: { teamId: string, appId: string, crashGroupId: string, crashGroupName: string } }) {
  return (
    <CrashOrAnrGroupDetails crashOrAnrType={CrashOrAnrType.Crash} teamId={params.teamId} appId={params.appId} crashOrAnrGroupId={params.crashGroupId} crashOrAnrGroupName={params.crashGroupName} />
  )
}