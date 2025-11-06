"use client"

import { Button } from '@/app/components/button'
import { Card, CardContent, CardFooter } from '@/app/components/card'
import { useEffect, useState } from 'react'
import {
    EventTargetingRuleApiStatus,
    TraceTargetingRuleApiStatus,
    EventTargetingConfigApiStatus,
    TraceTargetingConfigApiStatus,
    EventTargetingRule,
    TraceTargetingRule,
    EventTargetingConfigResponse,
    TraceTargetingConfigResponse,
    fetchEventTargetingRuleFromServer,
    fetchTraceTargetingRuleFromServer,
    fetchEventTargetingConfigFromServer,
    fetchTraceTargetingConfigFromServer,
    emptyEventTargetingRule,
    emptyTraceTargetingRule,
    emptyEventTargetingConfigResponse,
    emptyTraceTargetingConfigResponse
} from '@/app/api/api_calls'
import LoadingBar from '@/app/components/loading_bar'

interface EventTraceRuleBuilderProps {
    type: 'event' | 'trace'
    mode: 'create' | 'edit'
    appId: string
    ruleId?: string
    onCancel: () => void
    onPrimaryAction: () => void
}

type PageState = {
    ruleData: EventTargetingRule | TraceTargetingRule | null
    configData: EventTargetingConfigResponse | TraceTargetingConfigResponse | null
}

export default function EventTraceRuleBuilder({
    type,
    mode,
    appId,
    ruleId,
    onCancel,
    onPrimaryAction,
}: EventTraceRuleBuilderProps) {
    const [apiStatus, setApiStatus] = useState<EventTargetingRuleApiStatus | TraceTargetingRuleApiStatus>(
        EventTargetingRuleApiStatus.Loading
    )
    const [pageState, setPageState] = useState<PageState>({
        ruleData: null,
        configData: null
    })

    useEffect(() => {
        fetchPageData()
    }, [mode, ruleId, appId, type])

    const fetchPageData = async () => {
        setApiStatus(EventTargetingRuleApiStatus.Loading)

        if (type === 'event') {
            // TEMPORARY: Using dummy response instead of actual API call
            // const configResult = await fetchEventTargetingConfigFromServer(appId)
            // if (configResult.status === EventTargetingConfigApiStatus.Error) {
            //     setApiStatus(EventTargetingRuleApiStatus.Error)
            //     return
            // }

            // Fetch rule data if in edit mode
            let ruleData = null
            if (mode === 'edit' && ruleId) {
                // TEMPORARY: Using dummy response instead of actual API call
                // const ruleResult = await fetchEventTargetingRuleFromServer(appId, ruleId)
                // if (ruleResult.status === EventTargetingRuleApiStatus.Error) {
                //     setApiStatus(EventTargetingRuleApiStatus.Error)
                //     return
                // }
                // ruleData = ruleResult.data
                ruleData = emptyEventTargetingRule
            }

            setPageState({
                ruleData,
                configData: emptyEventTargetingConfigResponse
            })
            setApiStatus(EventTargetingRuleApiStatus.Success)
        } else {
            // TEMPORARY: Using dummy response instead of actual API call
            // const configResult = await fetchTraceTargetingConfigFromServer(appId)
            // if (configResult.status === TraceTargetingConfigApiStatus.Error) {
            //     setApiStatus(TraceTargetingRuleApiStatus.Error)
            //     return
            // }

            // Fetch rule data if in edit mode
            let ruleData = null
            if (mode === 'edit' && ruleId) {
                // TEMPORARY: Using dummy response instead of actual API call
                // const ruleResult = await fetchTraceTargetingRuleFromServer(appId, ruleId)
                // if (ruleResult.status === TraceTargetingRuleApiStatus.Error) {
                //     setApiStatus(TraceTargetingRuleApiStatus.Error)
                //     return
                // }
                // ruleData = ruleResult.data
                ruleData = emptyTraceTargetingRule
            }

            setPageState({
                ruleData,
                configData: emptyTraceTargetingConfigResponse
            })
            setApiStatus(TraceTargetingRuleApiStatus.Success)
        }
    }

    const getTitle = () => {
        const typeLabel = type === 'event' ? 'Event' : 'Trace'
        if (mode === 'create') {
            return `Create ${typeLabel} Rule`
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
