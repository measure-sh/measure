"use client"

import { Button } from '@/app/components/button'
import { Card, CardContent, CardFooter } from '@/app/components/card'

interface EventTraceRuleBuilderProps {
    type: 'event' | 'trace'
    mode: 'create' | 'edit'
    onCancel: () => void
    onPrimaryAction: () => void
    children?: React.ReactNode
}

export default function EventTraceRuleBuilder({
    type,
    mode,
    onCancel,
    onPrimaryAction,
    children
}: EventTraceRuleBuilderProps) {
    const getTitle = () => {
        const typeLabel = type === 'event' ? 'Event' : 'Trace'
        if (mode === 'create') {
            return `Create ${typeLabel} Filter`
        }
        return `Edit ${typeLabel} Rule`
    }

    const getPrimaryActionLabel = () => {
        return mode === 'create' ? 'Create Rule' : 'Save Changes'
    }

    return (
        <div className="flex flex-col selection:bg-yellow-200/75 items-start">
            <p className="font-display text-4xl max-w-6xl text-center">{getTitle()}</p>
            <div className="py-4" />

            <Card className="w-full">
                <CardContent className="pt-6">
                    <div className="mb-6">
                        {children}
                    </div>
                </CardContent>

                <CardFooter className="flex justify-end gap-3">
                    <Button
                        variant="outline"
                        onClick={onCancel}
                        className="font-display"
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="outline"
                        onClick={onPrimaryAction}
                        className="font-display border border-black"
                    >
                        {getPrimaryActionLabel()}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
