"use client"

import { emptySamplingRulesConfigResponse, fetchSamplingRulesConfigFromServer, SamplingRulesConfigApiStatus } from '@/app/api/api_calls';
import LoadingBar from '@/app/components/loading_bar';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const samplingRuleTypeKey = "type"

interface PageState {
    samplingRulesConfigApiStatus: SamplingRulesConfigApiStatus
    samplingRulesConfig: typeof emptySamplingRulesConfigResponse
}


export default function CreateSamplingRule({ params }: { params: { teamId: string, appId: string } }) {
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
    }, [pageState.samplingRulesConfig])


    return (
        <div className="flex flex-col selection:bg-yellow-200/75 items-start">
            <div className="flex flex-row items-center gap-2 justify-between w-full">
                <p className="font-display text-4xl max-w-6xl text-center capitalize">
                    Create {type} sampling rule
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

                    <div className="py-4" />
                </div>}
        </div>
    );
}