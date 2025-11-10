"use client"

import { useRouter } from 'next/navigation'
import EventRuleBuilder from '@/app/components/targeting/event_rule_builder'

export default function CreateEventRule({ params }: { params: { teamId: string, appId: string } }) {
    const router = useRouter()

    const handleCancel = () => {
        router.back()
    }

    const handleCreate = () => {
        router.back()
    }

    const handleDelete = () => {
        router.back()
    }

    return (
        <EventRuleBuilder
            mode="create"
            appId={params.appId}
            onCancel={handleCancel}
            onSave={handleCreate}
            onDelete={handleDelete}
        />
    )
}
