"use client"

import { Button } from '@/app/components/button'
import { Card, CardContent, CardFooter } from '@/app/components/card'
import { useEffect, useState } from 'react'
import {
    EventTargetingRuleApiStatus,
    TraceTargetingRuleApiStatus,
    EventTargetingRule,
    TraceTargetingRule,
    fetchEventTargetingRuleFromServer,
    fetchTraceTargetingRuleFromServer,
    emptyEventTargetingRule,
    emptyTraceTargetingRule
} from '@/app/api/api_calls'
import LoadingBar from '@/app/components/loading_bar'

interface EventTraceRuleBuilderProps {
    type: 'event' | 'trace'
    mode: 'create' | 'edit'
    appId: string
    ruleId?: string
    onCancel: () => void
    onPrimaryAction: () => void
    children?: React.ReactNode
}

export default function EventTraceRuleBuilder({
    type,
    mode,
    appId,
    ruleId,
    onCancel,
    onPrimaryAction,
    children
}: EventTraceRuleBuilderProps) {
    const [apiStatus, setApiStatus] = useState<EventTargetingRuleApiStatus | TraceTargetingRuleApiStatus>(
        mode === 'create'
            ? EventTargetingRuleApiStatus.Success
            : EventTargetingRuleApiStatus.Loading
    )
    const [ruleData, setRuleData] = useState<EventTargetingRule | TraceTargetingRule | null>(null)

    useEffect(() => {
        if (mode === 'edit' && ruleId) {
            fetchRuleData()
        }
    }, [mode, ruleId, appId])

    const fetchEventRuleData = async () => {
        if (!ruleId) return

        setApiStatus(EventTargetingRuleApiStatus.Loading)

        // TEMPORARY: Using dummy response instead of actual API call
        // const result = await fetchEventTargetingRuleFromServer(appId, ruleId)
        // if (result.status === EventTargetingRuleApiStatus.Error) {
        //     setApiStatus(EventTargetingRuleApiStatus.Error)
        //     return
        // }
        // setRuleData(result.data)

        // Using dummy data temporarily
        setRuleData(emptyEventTargetingRule)
        setApiStatus(EventTargetingRuleApiStatus.Success)
    }

    const fetchTraceRuleData = async () => {
        if (!ruleId) return

        setApiStatus(TraceTargetingRuleApiStatus.Loading)

        // TEMPORARY: Using dummy response instead of actual API call
        // const result = await fetchTraceTargetingRuleFromServer(appId, ruleId)
        // if (result.status === TraceTargetingRuleApiStatus.Error) {
        //     setApiStatus(TraceTargetingRuleApiStatus.Error)
        //     return
        // }
        // setRuleData(result.data)

        // Using dummy data temporarily
        setRuleData(emptyTraceTargetingRule)
        setApiStatus(TraceTargetingRuleApiStatus.Success)
    }

    const fetchRuleData = async () => {
        if (type === 'event') {
            await fetchEventRuleData()
        } else {
            await fetchTraceRuleData()
        }
    }

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

    const isLoading = apiStatus === EventTargetingRuleApiStatus.Loading ||
                      apiStatus === TraceTargetingRuleApiStatus.Loading
    const hasError = apiStatus === EventTargetingRuleApiStatus.Error ||
                     apiStatus === TraceTargetingRuleApiStatus.Error
    const isReady = apiStatus === EventTargetingRuleApiStatus.Success ||
                    apiStatus === TraceTargetingRuleApiStatus.Success

    return (
        <div className="flex flex-col selection:bg-yellow-200/75 items-start">
            <p className="font-display text-4xl max-w-6xl text-center">{getTitle()}</p>
            <div className="py-4" />

            {/* Loading indicator */}
            <div className={`py-1 w-full ${isLoading ? 'visible' : 'invisible'}`}>
                <LoadingBar />
            </div>

            {/* Error state */}
            {hasError && (
                <div className="w-full flex flex-col items-center">
                    <p className="text-normal font-body">
                        Error loading rule. Please try again or go back.
                    </p>
                    <div className="py-4" />
                    <Button
                        variant="outline"
                        onClick={onCancel}
                        className="font-display border border-black select-none"
                    >
                        Go Back
                    </Button>
                </div>
            )}

            {/* Main content */}
            {isReady && (
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
            )}
        </div>
    )
}
