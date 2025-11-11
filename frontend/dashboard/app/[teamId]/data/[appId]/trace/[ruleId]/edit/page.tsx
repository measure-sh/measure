"use client"

import { useRouter } from 'next/navigation'
import RuleBuilder from '@/app/components/targeting/rule_builder'

export default function EditTraceRule({ params }: { params: { teamId: string, appId: string, ruleId: string } }) {
    const router = useRouter()

    const handleCancel = () => {
        router.back()
    }

    const handleSave = () => {
        router.back()
    }

    const handleDelete = () => {
        router.back()
    }

    return (
        <RuleBuilder
            type='trace'
            mode='edit'
            appId={params.appId}
            ruleId={params.ruleId}
            onCancel={handleCancel}
            onSave={handleSave}
            onDelete={handleDelete}
        />
    )
}
