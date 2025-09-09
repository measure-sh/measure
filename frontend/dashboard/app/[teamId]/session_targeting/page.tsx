"use client"

import { FilterSource, SessionTargetingRulesApiStatus, emptySessionTargetingRulesResponse, fetchSessionTargetingRulesFromServer } from "@/app/api/api_calls";
import CreateSamplingRule from "@/app/components/create_sampling_rule";
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from "@/app/components/filters";
import LoadingBar from "@/app/components/loading_bar";
import Paginator from "@/app/components/paginator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/table';
import { formatDateToHumanReadableDate, formatDateToHumanReadableTime } from "@/app/utils/time_utils";
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from "react";

interface PageState {
    targetingRulesApiStatus: SessionTargetingRulesApiStatus
    filters: typeof defaultFilters
    targetingRules: typeof emptySessionTargetingRulesResponse
    paginationOffset: number
}

const paginationLimit = 10
const paginationOffsetUrlKey = "po"

export default function SessionTargetingOverview({ params }: { params: { teamId: string } }) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const initialState: PageState = {
        targetingRulesApiStatus: SessionTargetingRulesApiStatus.Loading,
        filters: defaultFilters,
        targetingRules: emptySessionTargetingRulesResponse,
        paginationOffset: searchParams.get(paginationOffsetUrlKey) ? parseInt(searchParams.get(paginationOffsetUrlKey)!) : 0
    }

    const [pageState, setPageState] = useState<PageState>(initialState)

    const updatePageState = (newState: Partial<PageState>) => {
        setPageState(prevState => {
            const updatedState = { ...prevState, ...newState }
            return updatedState
        })
    }

    const getTargetingRules = async () => {
        updatePageState({ targetingRulesApiStatus: SessionTargetingRulesApiStatus.Loading })
        const result = await fetchSessionTargetingRulesFromServer(pageState.filters.app!.id, paginationLimit, pageState.paginationOffset)

        switch (result.status) {
            case SessionTargetingRulesApiStatus.Error:
                updatePageState({ targetingRulesApiStatus: SessionTargetingRulesApiStatus.Error })
                break
            case SessionTargetingRulesApiStatus.Success:
                updatePageState({
                    targetingRulesApiStatus: SessionTargetingRulesApiStatus.Success,
                    targetingRules: result.data
                })
                break
        }
    }

    const handleFiltersChanged = (updatedFilters: typeof defaultFilters) => {
        // update filters only if they have changed
        if (pageState.filters.ready !== updatedFilters.ready || pageState.filters.serialisedFilters !== updatedFilters.serialisedFilters) {
            updatePageState({
                filters: updatedFilters,
                // Reset pagination on filters change if previous filters were not default filters
                paginationOffset: pageState.filters.serialisedFilters && searchParams.get(paginationOffsetUrlKey) ? 0 : pageState.paginationOffset
            })
        }
    }

    const handleNextPage = () => {
        updatePageState({ paginationOffset: pageState.paginationOffset + paginationLimit })
    }

    const handlePrevPage = () => {
        updatePageState({ paginationOffset: Math.max(0, pageState.paginationOffset - paginationLimit) })
    }

    useEffect(() => {
        if (!pageState.filters.ready) {
            return
        }

        // update url
        router.replace(`?${paginationOffsetUrlKey}=${encodeURIComponent(pageState.paginationOffset)}&${pageState.filters.serialisedFilters!}`, { scroll: false })

        getTargetingRules()
    }, [pageState.paginationOffset, pageState.filters])

    return (
        <div className="flex flex-col selection:bg-yellow-200/75 items-start">
            <div className="flex flex-row items-center gap-2 justify-between w-full">
                <p className="font-display text-4xl max-w-6xl text-center">Session Targeting</p>
                <CreateSamplingRule onSelect={() => {
                    router.push(`/${params.teamId}/session_targeting/${pageState.filters.app!.id}//create`)
                }} />
            </div>

            <div className="py-4" />

            {/* Shows app selector */}
            <Filters
                teamId={params.teamId}
                filterSource={FilterSource.Events}
                appVersionsInitialSelectionType={AppVersionsInitialSelectionType.All}
                showNoData={false}
                showNotOnboarded={false}
                showAppSelector={true}
                showAppVersions={false}
                showDates={false}
                showSessionType={false}
                showOsVersions={false}
                showCountries={false}
                showNetworkTypes={false}
                showNetworkProviders={false}
                showNetworkGenerations={false}
                showLocales={false}
                showDeviceManufacturers={false}
                showDeviceNames={false}
                showBugReportStatus={false}
                showUdAttrs={false}
                showFreeText={false}
                onFiltersChanged={handleFiltersChanged} />

            {/* Error state for sampling rules fetch */}
            {pageState.filters.ready
                && pageState.targetingRulesApiStatus === SessionTargetingRulesApiStatus.Error
                && <p className="text-lg font-display">Error fetching sampling rules, please change filters, refresh page or select a different app to try again</p>}

            {/* Main sampling rules UI */}
            {pageState.filters.ready
                && (pageState.targetingRulesApiStatus === SessionTargetingRulesApiStatus.Success || pageState.targetingRulesApiStatus === SessionTargetingRulesApiStatus.Loading) &&
                <div className="flex flex-col items-center w-full">
                    <div className='self-end'>
                        <Paginator
                            prevEnabled={pageState.targetingRulesApiStatus === SessionTargetingRulesApiStatus.Loading ? false : pageState.targetingRules.meta.previous}
                            nextEnabled={pageState.targetingRulesApiStatus === SessionTargetingRulesApiStatus.Loading ? false : pageState.targetingRules.meta.next}
                            displayText=''
                            onNext={handleNextPage}
                            onPrev={handlePrevPage}
                        />
                    </div>

                    <div className={`py-1 w-full ${pageState.targetingRulesApiStatus === SessionTargetingRulesApiStatus.Loading ? 'visible' : 'invisible'}`}>
                        <LoadingBar />
                    </div>

                    <div className="py-4" />

                    <Table className="font-display">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[60%]">Rule</TableHead>
                                <TableHead className="w-[25%]">Last Modified</TableHead>
                                <TableHead className="w-[15%] text-center p-4">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pageState.targetingRules.results?.map(({ id, name, status, last_modified_at, last_modified_by, sampling_rate }, idx) => {
                                const ruleHref = `/${params.teamId}/session_targeting/${pageState.filters.app!.id}/${id}/edit`
                                return (
                                    <TableRow
                                        key={`${idx}-${id}`}
                                        className="font-body hover:bg-yellow-200 focus-visible:border-yellow-200 select-none"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault()
                                                router.push(ruleHref)
                                            }
                                        }}
                                    >
                                        <TableCell className="w-[60%] relative p-0">
                                             <a
                                                href={ruleHref}
                                                className="absolute inset-0 z-10 cursor-pointer"
                                                tabIndex={-1}
                                                aria-label={`ID: ${id}`}
                                                style={{ display: 'block' }}
                                            />
                                            <div className="pointer-events-none p-4">
                                                <p className='truncate select-none flex-1'>{name}</p>
                                                <div className='py-1' />
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs text-gray-500 select-none">
                                                        Sampling rate: {sampling_rate * 100}%
                                                    </p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="w-[25%]">
                                            <p className='truncate select-none'>{formatDateToHumanReadableDate(last_modified_at)}, {formatDateToHumanReadableTime(last_modified_at)}</p>
                                            <p className='truncate select-none'>{last_modified_by}</p>
                                        </TableCell>
                                        <TableCell className="w-[15%] p-4">
                                            <div className="flex justify-center">
                                                <p className={`w-20 px-1 py-1 rounded-full border text-sm font-body select-none text-center ${status === 1 ? 'border-green-600 text-green-600 bg-green-50' : 'border-indigo-600 text-indigo-600 bg-indigo-50'}`}>
                                                    {status === 1 ? 'Enabled' : 'Disabled'}
                                                </p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>}
        </div>
    )
}
