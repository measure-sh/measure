"use client"

import { useRouter } from 'next/navigation'
import RuleBuilder from '@/app/components/targeting/rule_builder'

export default function CreateTraceRule({ params }: { params: { teamId: string, appId: string } }) {
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
            type='trace'
            mode='create'
            appId={params.appId}
            onCancel={handleCancel}
            onSave={handleCreate}
            onDelete={handleDelete}
        />
    )
}
