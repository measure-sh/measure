"use client"

import { useRouter } from 'next/navigation'
import TraceRuleBuilder from '@/app/components/targeting/trace_rule_builder'

export default function CreateTraceRule({ params }: { params: { teamId: string, appId: string } }) {
    const router = useRouter()

    const handleCancel = () => {
        router.back()
    }

    const handleCreate = () => {
        router.back()
    }

    return (
        <TraceRuleBuilder
            mode="create"
            appId={params.appId}
            onCancel={handleCancel}
            onSave={handleCreate}
        />
    )
}
