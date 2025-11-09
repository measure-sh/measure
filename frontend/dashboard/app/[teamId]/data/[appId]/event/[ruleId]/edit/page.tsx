"use client"

import { useRouter } from 'next/navigation'
import EventRuleBuilder from '@/app/components/targeting/event_rule_builder'

export default function EditEventRule({ params }: { params: { teamId: string, appId: string, ruleId: string } }) {
    const router = useRouter()

    const handleCancel = () => {
        router.back()
    }

    const handleSave = () => {
        router.back()
    }

    return (
        <EventRuleBuilder
            mode="edit"
            appId={params.appId}
            ruleId={params.ruleId}
            onCancel={handleCancel}
            onSaved={handleSave}
        />
    )
}
