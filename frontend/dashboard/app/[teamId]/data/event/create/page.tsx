"use client"

import { useRouter } from 'next/navigation'
import EventTraceRuleBuilder from '@/app/components/targeting/event_trace_rule_builder'

export default function CreateEventFilter({ params }: { params: { teamId: string } }) {
    const router = useRouter()

    const handleCancel = () => {
        router.push(`/${params.teamId}/data`)
    }

    const handleCreate = () => {
        // TODO: Implement create logic
        router.push(`/${params.teamId}/data`)
    }

    return (
        <EventTraceRuleBuilder
            type="event"
            mode="create"
            onCancel={handleCancel}
            onPrimaryAction={handleCreate}
        />
    )
}
