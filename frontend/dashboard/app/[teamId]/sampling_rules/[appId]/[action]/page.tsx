"use client"

import { dummySamplingRulesConfigResponse, emptySamplingRulesConfigResponse, fetchSamplingRulesConfigFromServer, SamplingRulesConfigApiStatus } from '@/app/api/api_calls';
import LoadingBar from '@/app/components/loading_bar';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import SamplingConditions from '@/app/components/sampling_conditions'; // Adjust the import path as needed

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

    return (
        <div className="flex flex-col selection:bg-yellow-200/75 items-start">
            <div className="flex flex-row items-center gap-2 justify-between w-full">
                <p className="font-display text-4xl max-w-6xl text-center capitalize">
                    {isEditMode ? 'Edit' : 'Create'} {type} sampling rule
                </p>
            </div>
            <div className="py-4" />

            {/* Error state for sampling rules fetch */}
            {pageState.samplingRulesConfigApiStatus === SamplingRulesConfigApiStatus.Error
                && <p className="text-lg font-display">Error fetching sampling rules, please change filters, refresh page or select a different app to try again</p>}

            {/* Main sampling rules UI */}
            {(pageState.samplingRulesConfigApiStatus === SamplingRulesConfigApiStatus.Success || pageState.samplingRulesConfigApiStatus === SamplingRulesConfigApiStatus.Loading) &&
                <div className="flex flex-col items-center w-full">

                    <div className={`py-1 w-full ${pageState.samplingRulesConfigApiStatus === SamplingRulesConfigApiStatus.Loading ? 'visible' : 'invisible'}`}>
                        <LoadingBar />
                    </div>

                    {/* Conditions Section */}
                    <SamplingConditions samplingRulesConfig={pageState.samplingRulesConfig} />
                </div>}
        </div>
    );
}