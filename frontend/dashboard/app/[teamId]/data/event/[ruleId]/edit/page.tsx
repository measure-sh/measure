"use client"

import { useRouter } from 'next/navigation'
import EventTraceRuleBuilder from '@/app/components/targeting/event_trace_rule_builder'

export default function EditEventFilter({ params }: { params: { teamId: string, ruleId: string } }) {
    const router = useRouter()

    const handleCancel = () => {
        router.push(`/${params.teamId}/data`)
    }

    const handleSave = () => {
        router.push(`/${params.teamId}/data`)
    }

    return (
        <EventTraceRuleBuilder
            type="event"
            mode="edit"
            ruleId={params.ruleId}
            onCancel={handleCancel}
            onPrimaryAction={handleSave}
        />
    )
}
