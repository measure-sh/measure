"use client"

import { FilterSource, SessionTargetingRulesApiStatus, SessionTargetingRulesResponse, fetchSessionTargetingRulesFromServer } from "@/app/api/api_calls";
import CreateSessionTargetingRule from "@/app/components/session_targeting/create_session_targeting_rule";
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
    targetingRules: SessionTargetingRulesResponse | null
    paginationOffset: number
}

const paginationLimit = 5
const paginationOffsetUrlKey = "po"

export default function SessionTargetingOverview({ params }: { params: { teamId: string } }) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const initialState: PageState = {
        targetingRulesApiStatus: SessionTargetingRulesApiStatus.Loading,
        filters: defaultFilters,
        targetingRules: null,
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
                updatePageState({
                    targetingRulesApiStatus: SessionTargetingRulesApiStatus.Error,
                })
                break
            case SessionTargetingRulesApiStatus.NoData:
                updatePageState({
                    targetingRulesApiStatus: SessionTargetingRulesApiStatus.NoData,
                })
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
                paginationOffset: pageState.filters.serialisedFilters && searchParams.get(paginationOffsetUrlKey) ? 0 : pageState.paginationOffset,
                // Clear targeting rules to prevent showing stale data while new data loads
                targetingRules: null
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
                <CreateSessionTargetingRule
                    onSelect={() => {
                        router.push(`/${params.teamId}/session_targeting/${pageState.filters.app!.id}/create`)
                    }}
                    disabled={!pageState.filters.ready || pageState.targetingRulesApiStatus === SessionTargetingRulesApiStatus.Loading || pageState.targetingRulesApiStatus === SessionTargetingRulesApiStatus.Error}
                />
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

            {/* Empty state */}
            {pageState.filters.ready
                && pageState.targetingRulesApiStatus === SessionTargetingRulesApiStatus.NoData &&
                <div className="flex flex-col items-center">
                    <p className="font-body text-sm">No session targeting rules created for this app yet</p>
                    <div className="py-2" />
                </div>}

            {/* Main sampling rules UI */}
            {pageState.filters.ready
                && pageState.targetingRules
                && pageState.targetingRules.results.length > 0
                && (pageState.targetingRulesApiStatus === SessionTargetingRulesApiStatus.Success || pageState.targetingRulesApiStatus === SessionTargetingRulesApiStatus.Loading) &&
                <div className="flex flex-col items-center w-full">
                    <div className='self-end'>
                        <Paginator
                            prevEnabled={pageState.targetingRulesApiStatus === SessionTargetingRulesApiStatus.Loading ? false : pageState.targetingRules!.meta.previous}
                            nextEnabled={pageState.targetingRulesApiStatus === SessionTargetingRulesApiStatus.Loading ? false : pageState.targetingRules!.meta.next}
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
                                <TableHead className="w-[40%]">Rule name</TableHead>
                                <TableHead className="w-[20%] text-center">Last updated</TableHead>
                                <TableHead className="w-[20%] text-center">Updated by</TableHead>
                                <TableHead className="w-[20%] text-center p-4">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pageState.targetingRules?.results?.map(({ id, name, status, updated_at, updated_by, sampling_rate }, idx) => {
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
                                        <TableCell className="w-[40%] relative p-0">
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
                                                        Sampling rate: {sampling_rate}%
                                                    </p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="w-[20%] text-center relative p-0">
                                            <a
                                                href={ruleHref}
                                                className="absolute inset-0 z-10 cursor-pointer"
                                                tabIndex={-1}
                                                aria-hidden="true"
                                                style={{ display: 'block' }}
                                            />
                                            <div className="pointer-events-none p-4">
                                                <p className='truncate select-none'>{formatDateToHumanReadableDate(updated_at)}</p>
                                                <div className='py-1' />
                                                <p className='truncate select-none'>{formatDateToHumanReadableTime(updated_at)}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="w-[20%] text-center relative p-0">
                                            <a
                                                href={ruleHref}
                                                className="absolute inset-0 z-10 cursor-pointer"
                                                tabIndex={-1}
                                                aria-hidden="true"
                                                style={{ display: 'block' }}
                                            />
                                            <div className="pointer-events-none p-4">
                                                <p className='truncate select-none'>{updated_by}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="w-[20%] text-center relative p-0">
                                            <a
                                                href={ruleHref}
                                                className="absolute inset-0 z-10 cursor-pointer"
                                                tabIndex={-1}
                                                aria-hidden="true"
                                                style={{ display: 'block' }}
                                            />
                                            <div className="pointer-events-none p-4 items-center flex justify-center">
                                                <p className={`w-22 px-2 py-1 rounded-full border text-sm font-body select-none text-center ${status === 1 ? 'border-green-600 text-green-600 bg-green-50' : 'border-indigo-600 text-indigo-600 bg-indigo-50'}`}>
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
