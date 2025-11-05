"use client"

import { useRouter } from 'next/navigation'
import EventTraceRuleBuilder from '@/app/components/targeting/event_trace_rule_builder'

export default function EditTraceFilter({ params }: { params: { teamId: string, appId: string, ruleId: string } }) {
    const router = useRouter()

    const handleCancel = () => {
        router.back()
    }

    const handleSave = () => {
        // TODO: Implement save logic
        router.back()
    }

    return (
        <EventTraceRuleBuilder
            type="trace"
            mode="edit"
            appId={params.appId}
            ruleId={params.ruleId}
            onCancel={handleCancel}
            onPrimaryAction={handleSave}
        />
    )
}
