"use client"

import { useRouter } from 'next/navigation'
import EventTraceRuleBuilder from '@/app/components/targeting/event_trace_rule_builder'

export default function CreateEventRule({ params }: { params: { teamId: string, appId: string } }) {
    const router = useRouter()

    const handleCancel = () => {
        router.back()
    }

    const handleCreate = () => {
        // TODO: Implement create logic
        router.back()
    }

    return (
        <EventTraceRuleBuilder
            type="event"
            mode="create"
            appId={params.appId}
            onCancel={handleCancel}
            onPrimaryAction={handleCreate}
        />
    )
}
