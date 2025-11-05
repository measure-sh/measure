"use client"

import { useRouter } from 'next/navigation'
import EventTraceRuleBuilder from '@/app/components/targeting/event_trace_rule_builder'

export default function EditEventFilter({ params }: { params: { teamId: string, appId: string, ruleId: string } }) {
    const router = useRouter()

    const handleCancel = () => {
        router.back()
    }

    const handleSave = () => {
        router.back()
    }

    return (
        <EventTraceRuleBuilder
            type="event"
            mode="edit"
            appId={params.appId}
            ruleId={params.ruleId}
            onCancel={handleCancel}
            onPrimaryAction={handleSave}
        />
    )
}
