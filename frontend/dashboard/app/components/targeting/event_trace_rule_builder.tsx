"use client"

import { Button } from '@/app/components/button'
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
    ruleApiStatus: EventTargetingRuleApiStatus | TraceTargetingRuleApiStatus
    configApiStatus: EventTargetingConfigApiStatus | TraceTargetingConfigApiStatus
}

export default function EventTraceRuleBuilder({
    type,
    mode,
    appId,
    ruleId,
    onCancel,
    onPrimaryAction,
}: EventTraceRuleBuilderProps) {
    const [pageState, setPageState] = useState<PageState>({
        ruleData: null,
        configData: null,
        ruleApiStatus: EventTargetingRuleApiStatus.Loading,
        configApiStatus: EventTargetingConfigApiStatus.Loading
    })

    useEffect(() => {
        fetchPageData()
    }, [mode, ruleId, appId, type])

    const fetchPageData = async () => {
        setPageState(prev => ({
            ...prev,
            ruleApiStatus: EventTargetingRuleApiStatus.Loading,
            configApiStatus: EventTargetingConfigApiStatus.Loading
        }))

        if (type === 'event') {
            // const configResult = await fetchEventTargetingConfigFromServer(appId)
            // if (configResult.status === EventTargetingConfigApiStatus.Error) {
            //     setPageState(prev => ({
            //         ...prev,
            //         configApiStatus: EventTargetingConfigApiStatus.Error
            //     }))
            //     return
            // }

            // Fetch rule data if in edit mode
            let ruleData = null
            let ruleApiStatus = EventTargetingRuleApiStatus.Success
            if (mode === 'edit' && ruleId) {
                // const ruleResult = await fetchEventTargetingRuleFromServer(appId, ruleId)
                // if (ruleResult.status === EventTargetingRuleApiStatus.Error) {
                //     setPageState(prev => ({
                //         ...prev,
                //         ruleApiStatus: EventTargetingRuleApiStatus.Error,
                //         configApiStatus: EventTargetingConfigApiStatus.Success,
                //         configData: configResult.data
                //     }))
                //     return
                // }
                // ruleData = ruleResult.data
                ruleData = emptyEventTargetingRule
            }

            setPageState({
                ruleData,
                configData: emptyEventTargetingConfigResponse,
                ruleApiStatus,
                configApiStatus: EventTargetingConfigApiStatus.Success
            })
        } else {
            // const configResult = await fetchTraceTargetingConfigFromServer(appId)
            // if (configResult.status === TraceTargetingConfigApiStatus.Error) {
            //     setPageState(prev => ({
            //         ...prev,
            //         configApiStatus: TraceTargetingConfigApiStatus.Error
            //     }))
            //     return
            // }

            // Fetch rule data if in edit mode
            let ruleData = null
            let ruleApiStatus = TraceTargetingRuleApiStatus.Success
            if (mode === 'edit' && ruleId) {
                // const ruleResult = await fetchTraceTargetingRuleFromServer(appId, ruleId)
                // if (ruleResult.status === TraceTargetingRuleApiStatus.Error) {
                //     setPageState(prev => ({
                //         ...prev,
                //         ruleApiStatus: TraceTargetingRuleApiStatus.Error,
                //         configApiStatus: TraceTargetingConfigApiStatus.Success,
                //         configData: configResult.data
                //     }))
                //     return
                // }
                // ruleData = ruleResult.data
                ruleData = emptyTraceTargetingRule
            }

            setPageState({
                ruleData,
                configData: emptyTraceTargetingConfigResponse,
                ruleApiStatus,
                configApiStatus: TraceTargetingConfigApiStatus.Success
            })
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

    const isLoading = () => {
        return pageState.ruleApiStatus === EventTargetingRuleApiStatus.Loading ||
               pageState.ruleApiStatus === TraceTargetingRuleApiStatus.Loading ||
               pageState.configApiStatus === EventTargetingConfigApiStatus.Loading ||
               pageState.configApiStatus === TraceTargetingConfigApiStatus.Loading
    }

    const hasError = () => {
        return pageState.ruleApiStatus === EventTargetingRuleApiStatus.Error ||
               pageState.ruleApiStatus === TraceTargetingRuleApiStatus.Error ||
               pageState.configApiStatus === EventTargetingConfigApiStatus.Error ||
               pageState.configApiStatus === TraceTargetingConfigApiStatus.Error
    }

    const isReady = () => {
        return (pageState.ruleApiStatus === EventTargetingRuleApiStatus.Success ||
                pageState.ruleApiStatus === TraceTargetingRuleApiStatus.Success) &&
               (pageState.configApiStatus === EventTargetingConfigApiStatus.Success ||
                pageState.configApiStatus === TraceTargetingConfigApiStatus.Success)
    }


    return (
        <div className="flex flex-col selection:bg-yellow-200/75 items-start">
            <p className="font-display text-4xl max-w-6xl text-center">{getTitle()}</p>
            <div className="py-4" />

            {/* Loading indicator */}
            <div className={`py-1 w-full ${isLoading() ? 'visible' : 'invisible'}`}>
                <LoadingBar />
            </div>

            {/* Error state */}
            {hasError() && (
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
            {isReady() && (
                <div className="w-full flex flex-col">
                    {/* Reserved space for content */}
                    <div className="mb-6">
                    </div>

                    {/* Action buttons */}
                    <div className="flex justify-end gap-3">
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
                    </div>
                </div>
            )}
        </div>
    )
}
