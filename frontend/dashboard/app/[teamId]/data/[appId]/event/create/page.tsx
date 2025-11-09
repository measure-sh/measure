"use client"

import { useRouter } from 'next/navigation'
import EventRuleBuilder from '@/app/components/targeting/event_rule_builder'

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
        <EventRuleBuilder
            mode="create"
            appId={params.appId}
            onCancel={handleCancel}
            onSaved={handleCreate}
        />
    )
}
