"use client"

import { useRouter } from 'next/navigation'
import TraceRuleBuilder from '@/app/components/targeting/trace_rule_builder'

export default function EditTraceRule({ params }: { params: { teamId: string, appId: string, ruleId: string } }) {
    const router = useRouter()

    const handleCancel = () => {
        router.back()
    }

    const handleSave = () => {
        // TODO: Implement save logic
        router.back()
    }

    return (
        <TraceRuleBuilder
            mode="edit"
            appId={params.appId}
            ruleId={params.ruleId}
            onCancel={handleCancel}
            onPrimaryAction={handleSave}
        />
    )
}
