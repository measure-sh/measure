"use client"

import { FilterSource } from '@/app/api/api_calls'
import DebounceTextInput from '@/app/components/debounce_text_input'
import Filters, { AppVersionsInitialSelectionType } from '@/app/components/filters'
import Journey, { JourneyType } from '@/app/components/journey'
import TabSelect from '@/app/components/tab_select'
import { useFiltersStore, useUserJourneysStore } from '@/app/stores/provider'
import { PlotType } from '@/app/stores/user_journeys_store'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { underlineLinkStyle } from '../utils/shared_styles'

interface UserJourneysProps {
    params?: { teamId: string }
    demo?: boolean
    hideDemoTitle?: boolean
}

export default function UserJourneys({ params = { teamId: 'demo-team-id' }, demo = false, hideDemoTitle = false }: UserJourneysProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const filters = useFiltersStore(state => state.filters)

    const { plotType, searchText, setPlotType, setSearchText } = useUserJourneysStore()

    const journeyTypeUrlKey = "jt"

    // Initialize plot type from URL on mount
    useEffect(() => {
        const jt = searchParams.get(journeyTypeUrlKey)
        if (jt === PlotType.Exceptions) {
            setPlotType(PlotType.Exceptions)
        }
    }, [])

    // Sync filters and plot type to URL
    useEffect(() => {
        if (!filters.ready) {
            return
        }
        const queryParams = `${journeyTypeUrlKey}=${encodeURIComponent(plotType)}&${filters.serialisedFilters!}`
        router.replace(`?${queryParams}`, { scroll: false })
    }, [filters.ready, filters.serialisedFilters, plotType])

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
                    showHttpMethods={false}
                    showFreeText={false}
                    showUdAttrs={false}
                />}

            {(demo || filters.ready) && (
                <>
                    {/* TabSelect for plot type */}
                    <div className="w-full flex justify-end pb-2 pr-2">
                        <TabSelect
                            items={Object.values(PlotType)}
                            selected={plotType}
                            onChangeSelected={item => {
                                setPlotType(item as PlotType)
                            }}
                        />
                    </div>

                    {/* Main content area */}
                    <div className='w-full h-[800px]'>
                        {!demo && <div className="py-2" />}
                        {!demo && <DebounceTextInput className="w-full" id="free-text" placeholder="Search nodes..." initialValue={''} onChange={(it) => setSearchText(it)} />}
                        {!demo && <p className='py-4 text-xs font-body'>Note: Journeys are approximated based on sampled journey events. <Link href="/docs/features/configuration-options#journey-sampling" className={underlineLinkStyle}>Learn more</Link> </p>}
                        <div className="py-4" />

                        {plotType === PlotType.Paths &&
                            <Journey
                                teamId={params.teamId}
                                bidirectional={false}
                                journeyType={JourneyType.Paths}
                                exceptionsGroupId={null}
                                searchText={searchText}
                                demo={demo}
                            />}
                        {plotType === PlotType.Exceptions &&
                            <Journey
                                teamId={params.teamId}
                                bidirectional={false}
                                journeyType={JourneyType.Exceptions}
                                exceptionsGroupId={null}
                                searchText={searchText}
                                demo={demo}
                            />}
                    </div>
                </>
            )}
        </div>
    )
}