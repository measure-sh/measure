"use client"

import { emptySamplingRulesConfigResponse, fetchSamplingRulesConfigFromServer, SamplingRulesConfigApiStatus } from '@/app/api/api_calls';
import { Button } from '@/app/components/button';
import LoadingBar from '@/app/components/loading_bar';
import SamplingConditions from '@/app/components/sampling_conditions';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Edit2 } from 'lucide-react';

export type SamplingRulesConfig = typeof emptySamplingRulesConfigResponse;
const samplingRuleTypeKey = "type"

interface PageState {
    samplingRulesConfigApiStatus: SamplingRulesConfigApiStatus
    samplingRulesConfig: typeof emptySamplingRulesConfigResponse
}

export default function CreateSamplingRule({ params }: { params: { teamId: string; appId: string; action: string } }) {
    const isEditMode = params.action === 'edit'
    const searchParams = useSearchParams()
    const type = searchParams.get(samplingRuleTypeKey)

    const initialState: PageState = {
        samplingRulesConfigApiStatus: SamplingRulesConfigApiStatus.Loading,
        samplingRulesConfig: emptySamplingRulesConfigResponse,
    }

    const [pageState, setPageState] = useState<PageState>(initialState)
    const [samplingRuleName, setSamplingRuleName] = useState<string>()
    const [isEditingRuleName, setIsEditingRuleName] = useState<boolean>(false)

    const updatePageState = (newState: Partial<PageState>) => {
        setPageState(prevState => {
            const updatedState = { ...prevState, ...newState }
            return updatedState
        })
    }

    const getSamplingRulesConfig = async () => {
        updatePageState({ samplingRulesConfigApiStatus: SamplingRulesConfigApiStatus.Loading })
        const result = await fetchSamplingRulesConfigFromServer(params.teamId, params.appId)

        switch (result.status) {
            case SamplingRulesConfigApiStatus.Error:
                updatePageState({ samplingRulesConfigApiStatus: SamplingRulesConfigApiStatus.Error })
                break
            case SamplingRulesConfigApiStatus.Success:
                updatePageState({
                    samplingRulesConfigApiStatus: SamplingRulesConfigApiStatus.Success,
                    samplingRulesConfig: result.data
                })
                break
        }
    }

    useEffect(() => {
        getSamplingRulesConfig()
    }, [])

    const displayRuleName = samplingRuleName?.trim() || "New Sampling Rule";
    
    const handleEditClick = () => {
        setIsEditingRuleName(true);
    };

    const handleRuleNameSubmit = (value: string) => {
        setSamplingRuleName(value.trim());
        setIsEditingRuleName(false);
    };

    const handleRuleNameCancel = () => {
        setIsEditingRuleName(false);
    };

    return (
        <div className="flex flex-col selection:bg-yellow-200/75 items-start">
            <div className="flex flex-row items-center gap-2 justify-between w-full">
                {!isEditingRuleName ? (
                    <div className="flex items-center gap-3">
                        <h1 className="font-display text-4xl first-letter:capitalize truncate max-w-2xl">{displayRuleName}</h1>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleEditClick}
                            className="flex items-center gap-2 px-3 py-1 hover:bg-gray-100"
                        >
                            <Edit2 className="h-4 w-4" />
                            <span className="text-sm">Edit rule name</span>
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 py-2">
                        <input
                            type="text"
                            placeholder="Enter rule name, e.g., Critical Issues"
                            value={samplingRuleName || ""}
                            maxLength={64}
                            onChange={(e) => {
                                const value = e.target.value;
                                const capitalizedValue = value.charAt(0).toUpperCase() + value.slice(1);
                                setSamplingRuleName(capitalizedValue);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleRuleNameSubmit(e.currentTarget.value);
                                } else if (e.key === 'Escape') {
                                    handleRuleNameCancel();
                                }
                            }}
                            onBlur={(e) => handleRuleNameSubmit(e.target.value)}
                            className="text-2xl font-display border border-black rounded-md outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] py-2 px-3 placeholder:text-neutral-400 placeholder:text-sm min-w-80"
                            style={{
                                width: `${Math.max(20, (samplingRuleName || "").length + 2)}ch`
                            }}
                            autoFocus
                        />
                    </div>
                )}
                {/* Only show Publish button when config is loaded */}
                {pageState.samplingRulesConfigApiStatus === SamplingRulesConfigApiStatus.Success && (
                    <Button
                        variant="outline"
                        className="font-display border border-black select-none"
                        onClick={() => console.log("Publish rule clicked")}
                    >
                        Publish Rule
                    </Button>
                )}
            </div>
            <div className="py-4" />

            {/* Error state for sampling rules config fetch */}
            {pageState.samplingRulesConfigApiStatus === SamplingRulesConfigApiStatus.Error && (
                <p className="text-lg font-display">
                    Error fetching sampling rules configuration. Please refresh the page to try again.
                </p>
            )}

            {/* Loading state */}
            {pageState.samplingRulesConfigApiStatus === SamplingRulesConfigApiStatus.Loading && (
                <div className="flex flex-col items-center w-full">
                    <div className="py-1 w-full">
                        <LoadingBar />
                    </div>
                </div>
            )}

            {/* Main sampling conditions UI - only show when config is successfully loaded */}
            {pageState.samplingRulesConfigApiStatus === SamplingRulesConfigApiStatus.Success && (
                <div className="flex flex-col items-center w-full">
                    <SamplingConditions samplingRulesConfig={pageState.samplingRulesConfig} />
                </div>
            )}
        </div>
    );
}