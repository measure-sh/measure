"use client"

import { FilterSource } from '@/app/api/api_calls'
import DebounceTextInput from '@/app/components/debounce_text_input'
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from '@/app/components/filters'
import Journey, { JourneyType } from '@/app/components/journey'
import TabSelect from '@/app/components/tab_select'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { underlineLinkStyle } from '../utils/shared_styles'

enum PlotType {
    Paths = "Paths",
    Exceptions = "Exceptions",
}

interface PageState {
    filters: typeof defaultFilters
    plotType: PlotType
    searchText: string
}

interface UserJourneysProps {
    params?: { teamId: string }
    demo?: boolean
    hideDemoTitle?: boolean
}

export default function UserJourneys({ params = { teamId: 'demo-team-id' }, demo = false, hideDemoTitle = false }: UserJourneysProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const journeyTypeUrlKey = "jt"

    // Determine initial plot type from URL or default
    const initialPlotType = (() => {
        const jt = searchParams.get(journeyTypeUrlKey)
        if (jt === PlotType.Exceptions) return PlotType.Exceptions
        return PlotType.Paths
    })()

    const initialState: PageState = {
        filters: defaultFilters,
        plotType: initialPlotType,
        searchText: ''
    }

    const [pageState, setPageState] = useState<PageState>(initialState)

    const updatePageState = (newState: Partial<PageState>) => {
        setPageState(prevState => {
            const updatedState = { ...prevState, ...newState }
            return updatedState
        })
    }

    const handleFiltersChanged = (updatedFilters: typeof defaultFilters) => {
        // update filters only if they have changed
        if (pageState.filters.ready !== updatedFilters.ready || pageState.filters.serialisedFilters !== updatedFilters.serialisedFilters) {
            updatePageState({
                filters: updatedFilters
            })
        }
    }

    useEffect(() => {
        if (!pageState.filters.ready) {
            return
        }
        const queryParams = `${journeyTypeUrlKey}=${encodeURIComponent(pageState.plotType)}&${pageState.filters.serialisedFilters!}`
        router.replace(`?${queryParams}`, { scroll: false })
    }, [pageState.filters, pageState.plotType])

    return (
        <div className="flex flex-col items-start">
            {!hideDemoTitle && <p className="font-display text-4xl max-w-6xl text-center">User Journeys</p>}
            <div className="py-4" />

            {!demo &&
                <Filters
                    teamId={params.teamId}
                    filterSource={FilterSource.Events}
                    appVersionsInitialSelectionType={AppVersionsInitialSelectionType.Latest}
                    showNoData={true}
                    showNotOnboarded={true}
                    showAppSelector={true}
                    showAppVersions={true}
                    showDates={true}
                    showSessionTypes={false}
                    showOsVersions={false}
                    showCountries={false}
                    showNetworkTypes={false}
                    showNetworkProviders={false}
                    showNetworkGenerations={false}
                    showLocales={false}
                    showDeviceManufacturers={false}
                    showDeviceNames={false}
                    showBugReportStatus={false}
                    showFreeText={false}
                    showUdAttrs={false}
                    onFiltersChanged={handleFiltersChanged} />}

            {(demo || pageState.filters.ready) && (
                <>
                    {/* TabSelect for plot type */}
                    <div className="w-full flex justify-end pb-2 pr-2">
                        <TabSelect
                            items={Object.values(PlotType)}
                            selected={pageState.plotType}
                            onChangeSelected={item => {
                                updatePageState({ plotType: item as PlotType })
                            }}
                        />
                    </div>

                    {/* Main content area */}
                    <div className='w-full h-[800px]'>
                        {!demo && <div className="py-2" />}
                        {!demo && <DebounceTextInput className="w-full" id="free-text" placeholder="Search nodes..." initialValue={''} onChange={(it) => setPageState(prev => ({ ...prev, searchText: it }))} />}
                        {!demo && <p className='py-4 text-xs font-body'>Note: Journeys are approximated based on sampled journey events. <Link href="https://github.com/measure-sh/measure/blob/main/docs/features/configuration-options.md#journey-sampling" target="_blank" className={underlineLinkStyle}>Learn more</Link> </p>}
                        <div className="py-4" />

                        {pageState.plotType === PlotType.Paths &&
                            <Journey
                                teamId={params.teamId}
                                bidirectional={false}
                                journeyType={JourneyType.Paths}
                                exceptionsGroupId={null}
                                filters={pageState.filters}
                                searchText={pageState.searchText}
                                demo={demo}
                            />}
                        {pageState.plotType === PlotType.Exceptions &&
                            <Journey
                                teamId={params.teamId}
                                bidirectional={false}
                                journeyType={JourneyType.Exceptions}
                                exceptionsGroupId={null}
                                filters={pageState.filters}
                                searchText={pageState.searchText}
                                demo={demo}
                            />}
                    </div>
                </>
            )}
        </div>
    )
}