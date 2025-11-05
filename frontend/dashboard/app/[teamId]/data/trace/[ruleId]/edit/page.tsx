"use client"

import { useRouter } from 'next/navigation'
import EventTraceRuleBuilder from '@/app/components/targeting/event_trace_rule_builder'

export default function EditTraceFilter({ params }: { params: { teamId: string, filterId: string } }) {
    const router = useRouter()

    const handleCancel = () => {
        router.push(`/${params.teamId}/data`)
    }

    const handleSave = () => {
        // TODO: Implement save logic
        router.push(`/${params.teamId}/data`)
    }

    return (
        <EventTraceRuleBuilder
            type="trace"
            mode="edit"
            onCancel={handleCancel}
            onPrimaryAction={handleSave}
        />
    )
}
