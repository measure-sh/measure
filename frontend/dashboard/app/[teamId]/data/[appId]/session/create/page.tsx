"use client"

import RuleBuilder from '@/app/components/targeting/rule_builder'
import { useRouter } from 'next/navigation'

export default function CreateSessionTimelineRule({ params }: { params: { teamId: string, appId: string } }) {
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
        <RuleBuilder
            type='timeline'
            mode='create'
            appId={params.appId}
            onCancel={handleCancel}
            onSave={handleCreate}
            onDelete={handleDelete}
        />
    )
}
