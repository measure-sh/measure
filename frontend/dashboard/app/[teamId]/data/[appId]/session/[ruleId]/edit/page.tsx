"use client"

import RuleBuilder from '@/app/components/targeting/rule_builder'
import { useRouter } from 'next/navigation'

export default function EditSessionTimelineRule({ params }: { params: { teamId: string, appId: string, ruleId: string } }) {
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
            mode='edit'
            appId={params.appId}
            ruleId={params.ruleId}
            onCancel={handleCancel}
            onSave={handleCreate}
            onDelete={handleDelete}
        />
    )
}
