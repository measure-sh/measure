import { AlertTriangle, CheckCircle, TrendingDown, TrendingUp } from 'lucide-react'
import React from 'react'
import { MetricsApiStatus } from '../api/api_calls'
import { numberToKMB, toKiloBytes, toMegaBytes } from '../utils/number_utils'
import { Card, CardContent, CardFooter } from './card'
import LoadingSpinner from './loading_spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'

// Style constants
const STYLES = {
    icon: {
        status: 'w-5 h-5',
        trend: 'w-4 h-4',
        tooltipIcon: 'w-4 h-4',
        green: 'text-green-600',
        yellow: 'text-yellow-600',
        red: 'text-red-600'
    },
    text: {
        mainValue: 'font-body font-semibold text-3xl',
        trendText: 'ml-2 font-body text-sm',
        subtitle: 'font-body text-sm',
        error: 'font-display font-semibold text-3xl',
        footerTitle: 'font-display text-gray-500 text-sm select-none',
        tooltipContent: 'p-2'
    },
    layout: {
        trendContainer: 'flex flex-row items-center',
        iconTextGap: 'gap-2',
        spacer: 'py-1',
        cardSize: 'w-full md:w-[300px] h-fit',
        cardContent: 'p-4 h-[100px] relative',
        cardFooter: 'p-4',
        contentFlex: 'flex flex-col h-full',
        statusIconPosition: 'absolute top-2 right-2',
        tooltipIconRow: 'flex items-center gap-2 mt-2',
        tooltipIconRowSmall: 'flex items-center gap-2 mt-1',
        tooltipSpacer: 'py-2'
    },
    tooltip: {
        content: 'font-display max-w-96 text-sm text-white fill-neutral-800 bg-neutral-800',
        text: 'p-2'
    }
} as const

export type MetricType = 'crash_free_sessions' | 'perceived_crash_free_sessions' | 'anr_free_sessions' | 'perceived_anr_free_sessions' | 'app_start_time' | 'app_size' | 'app_adoption'

export interface BaseMetricsCardProps {
    status: MetricsApiStatus
    noData: boolean
    type: MetricType
}

export interface CrashFreeSessionsProps extends BaseMetricsCardProps {
    type: 'crash_free_sessions'
    value: number
    delta: number
}

export interface PerceivedCrashFreeSessionsProps extends BaseMetricsCardProps {
    type: 'perceived_crash_free_sessions'
    value: number
    delta: number
}

export interface AnrFreeSessionsProps extends BaseMetricsCardProps {
    type: 'anr_free_sessions'
    value: number
    delta: number
}

export interface PerceivedAnrFreeSessionsProps extends BaseMetricsCardProps {
    type: 'perceived_anr_free_sessions'
    value: number
    delta: number
}

export interface AppStartTimeProps extends BaseMetricsCardProps {
    type: 'app_start_time'
    value: number
    delta: number
    noDelta: boolean
    launchType: string
}

export interface AppSizeProps extends BaseMetricsCardProps {
    type: 'app_size'
    multiVersion: boolean
    valueInBytes: number
    deltaInBytes: number
}

export interface AppAdoptionProps extends BaseMetricsCardProps {
    type: 'app_adoption'
    value: number
    sessions: number
    totalSessions: number
}

export type MetricsCardProps = CrashFreeSessionsProps | PerceivedCrashFreeSessionsProps | AnrFreeSessionsProps | PerceivedAnrFreeSessionsProps | AppStartTimeProps | AppSizeProps | AppAdoptionProps

// Title mapping function
const getMetricTitle = (type: MetricType, launchType?: string): string => {
    switch (type) {
        case 'crash_free_sessions':
            return 'Crash free sessions'
        case 'perceived_crash_free_sessions':
            return 'Perceived crash free sessions'
        case 'anr_free_sessions':
            return 'ANR free sessions'
        case 'perceived_anr_free_sessions':
            return 'Perceived ANR free sessions'
        case 'app_start_time':
            return `App ${launchType?.toLowerCase()} launch time`
        case 'app_size':
            return 'App size'
        case 'app_adoption':
            return 'App adoption'
        default:
            return 'Unknown metric'
    }
}

const StatusIconRow: React.FC<{
    icon: React.ReactNode,
    text: string,
    first?: boolean
}> = ({ icon, text, first = false }) => (
    <span className={first ? STYLES.layout.tooltipIconRow : STYLES.layout.tooltipIconRowSmall}>
        {icon} <span>{text}</span>
    </span>
)

// Reusable status icon rows for metrics with thresholds
const renderThresholdStatusIcons = () => (
    <>
        <StatusIconRow
            first
            icon={<CheckCircle className={`${STYLES.icon.tooltipIcon} ${STYLES.icon.green}`} />}
            text="Good (> 95%)"
        />
        <StatusIconRow
            icon={<AlertTriangle className={`${STYLES.icon.tooltipIcon} ${STYLES.icon.yellow}`} />}
            text="Caution (> 85%)"
        />
        <StatusIconRow
            icon={<AlertTriangle className={`${STYLES.icon.tooltipIcon} ${STYLES.icon.red}`} />}
            text="Poor (≤ 85%)"
        />
    </>
)

function getStatusIcon(value: number) {
    const iconClasses = `${STYLES.icon.status}`
    if (value > 95) {
        return <CheckCircle className={`${iconClasses} ${STYLES.icon.green}`} />
    } else if (value > 85) {
        return <AlertTriangle className={`${iconClasses} ${STYLES.icon.yellow}`} />
    } else {
        return <AlertTriangle className={`${iconClasses} ${STYLES.icon.red}`} />
    }
}

function getAppStartTimeStatusIcon(delta: number) {
    const iconClasses = `${STYLES.icon.status}`
    if (delta > 1) {
        return <AlertTriangle className={`${iconClasses} ${STYLES.icon.yellow}`} />
    } else {
        return <CheckCircle className={`${iconClasses} ${STYLES.icon.green}`} />
    }
}

function getAppSizeStatusIcon(multiVersion: boolean, deltaInBytes: number) {
    if (multiVersion) {
        return null;
    }
    const iconClasses = `${STYLES.icon.status}`
    if (deltaInBytes <= 0) {
        return <CheckCircle className={`${iconClasses} ${STYLES.icon.green}`} />
    } else {
        return <AlertTriangle className={`${iconClasses} ${STYLES.icon.yellow}`} />
    }
}

function getExceptionRateDeltaWithTrendIcon(delta: number) {
    if (delta > 1) {
        return (
            <div className={STYLES.layout.trendContainer}>
                <TrendingUp className={`${STYLES.icon.trend} ${STYLES.icon.green}`} />
                <p className={`${STYLES.text.trendText} ${STYLES.icon.green}`}>{delta}x better</p>
            </div>
        )
    }
    if (delta > 0 && delta < 1) {
        return (
            <div className={STYLES.layout.trendContainer}>
                <TrendingDown className={`${STYLES.icon.trend} ${STYLES.icon.yellow}`} />
                <p className={`${STYLES.text.trendText} ${STYLES.icon.yellow}`}>{delta}x worse</p>
            </div>
        )
    }
    return null
}

function getAppStartTimeDeltaWithTrendIcon(delta: number) {
    if (delta > 1) {
        return (
            <div className={STYLES.layout.trendContainer}>
                <TrendingUp className={`${STYLES.icon.trend} ${STYLES.icon.yellow}`} />
                <p className={`${STYLES.text.trendText} ${STYLES.icon.yellow}`}>{delta}x slower</p>
            </div>
        )
    }
    if (delta > 0 && delta < 1) {
        return (
            <div className={STYLES.layout.trendContainer}>
                <TrendingDown className={`${STYLES.icon.trend} ${STYLES.icon.green}`} />
                <p className={`${STYLES.text.trendText} ${STYLES.icon.green}`}>{delta}x faster</p>
            </div>
        )
    }
    return null
}

function getAppSizeDeltaWithTrendIcon(deltaInBytes: number) {
    if (deltaInBytes === 0) {
        return null;
    }

    const isNegative = deltaInBytes < 0;
    const absBytes = Math.abs(deltaInBytes);

    let value: string;
    let unit: string;

    if (absBytes >= 1024 * 1024) {
        // ≥ 1 MB → show in MB with 3 significant digits
        value = toMegaBytes(deltaInBytes).toPrecision(3);
        unit = 'MB';
    } else if (absBytes >= 1024) {
        // ≥ 1 KB → show in KB with 2 significant digits
        value = toKiloBytes(deltaInBytes).toFixed(2);
        unit = 'KB';
    } else {
        // < 1 KB → show raw bytes (no decimal)
        value = deltaInBytes.toString();
        unit = 'B';
    }

    const Icon = isNegative ? TrendingDown : TrendingUp;
    const colorClass = isNegative ? STYLES.icon.green : STYLES.icon.yellow;
    const sign = isNegative ? '' : '+';

    return (
        <div className={STYLES.layout.trendContainer}>
            <Icon className={`${STYLES.icon.trend} ${colorClass}`} />
            <p className={`${STYLES.text.trendText} ${colorClass}`}>
                {sign}{value} {unit}
            </p>
        </div>
    );
}

const MetricsCard: React.FC<MetricsCardProps> = (props) => {
    const { status, noData, type } = props
    const title = getMetricTitle(type, 'launchType' in props ? props.launchType : undefined)
    const renderCardContent = () => {
        if (status === MetricsApiStatus.Loading) {
            return <LoadingSpinner />
        }

        if (status === MetricsApiStatus.Error) {
            return <p className={STYLES.text.error}>Error</p>
        }

        if (noData) {
            return <p className={STYLES.text.mainValue}> No data</p>
        }

        switch (type) {
            case 'crash_free_sessions':
            case 'perceived_crash_free_sessions':
            case 'anr_free_sessions':
            case 'perceived_anr_free_sessions':
                const exceptionProps = props as CrashFreeSessionsProps | PerceivedCrashFreeSessionsProps | AnrFreeSessionsProps | PerceivedAnrFreeSessionsProps
                return (
                    <>
                        <p className={STYLES.text.mainValue}> {exceptionProps.value}%</p>
                        <div className={STYLES.layout.spacer} />
                        {getExceptionRateDeltaWithTrendIcon(exceptionProps.delta)}
                    </>
                )

            case 'app_start_time':
                const startTimeProps = props as AppStartTimeProps
                return (
                    <>
                        <p className={STYLES.text.mainValue}> {startTimeProps.value}ms</p>
                        <div className={STYLES.layout.spacer} />
                        {!startTimeProps.noDelta && getAppStartTimeDeltaWithTrendIcon(startTimeProps.delta)}
                    </>
                )

            case 'app_size':
                const sizeProps = props as AppSizeProps
                if (sizeProps.multiVersion) {
                    return (<>
                        <p className={STYLES.text.mainValue}> N/A</p>
                        <div className={STYLES.layout.spacer} />
                        <p className={`text-xs font-code`}>
                            App size metric is only available when a single app version is selected.
                        </p>
                    </>)
                } else {
                    return (<>
                        <p className={STYLES.text.mainValue}> {(sizeProps.valueInBytes / (1024 * 1024)).toPrecision(3)} MB</p>
                        <div className={STYLES.layout.spacer} />
                        {getAppSizeDeltaWithTrendIcon(sizeProps.deltaInBytes)}
                    </>)
                }

            case 'app_adoption':
                const adoptionProps = props as AppAdoptionProps
                return (
                    <>
                        <p className={STYLES.text.mainValue}> {adoptionProps.value}%</p>
                        <div className={STYLES.layout.spacer} />
                        <p className={STYLES.text.subtitle}>{numberToKMB(adoptionProps.sessions)}/{numberToKMB(adoptionProps.totalSessions)} sessions</p>
                    </>
                )

            default:
                return null
        }
    }

    const renderTooltipContent = () => {
        switch (type) {
            case 'crash_free_sessions':
                return (
                    <div className={STYLES.text.tooltipContent}>
                        <p>
                            Crash free sessions = (1 - Sessions which experienced a crash in selected app versions / Total sessions of selected app versions) * 100
                            <br /><br />
                            Delta value = Crash free sessions percentage of selected app versions / Crash free sessions percentage of unselected app versions
                        </p>
                        <br />
                        {renderThresholdStatusIcons()}
                    </div>
                )

            case 'perceived_crash_free_sessions':
                return (
                    <div className={STYLES.text.tooltipContent}>
                        <p>
                            Perceived crash free sessions = (1 - Sessions which experienced a visible crash in selected app versions / Total sessions of selected app versions) * 100
                            <br /><br />
                            Delta value = Perceived crash free sessions percentage of selected app versions / Perceived crash free sessions percentage of unselected app versions
                        </p>
                        <br />
                        {renderThresholdStatusIcons()}
                    </div>
                )

            case 'anr_free_sessions':
                return (
                    <div className={STYLES.text.tooltipContent}>
                        <p>
                            ANR free sessions = (1 - Sessions which experienced an ANR in selected app versions / Total sessions of selected app versions) * 100
                            <br /><br />
                            Delta value = ANR free sessions percentage of selected app versions / ANR free sessions percentage of unselected app versions
                        </p>
                        <br />
                        {renderThresholdStatusIcons()}
                    </div>
                )

            case 'perceived_anr_free_sessions':
                return (
                    <div className={STYLES.text.tooltipContent}>
                        <p>
                            Perceived ANR free sessions = (1 - Sessions which experienced a visible ANR in selected app versions / Total sessions of selected app versions) * 100
                            <br /><br />
                            Delta value = Perceived ANR free sessions percentage of selected app versions / Perceived ANR free sessions percentage of unselected app versions
                        </p>
                        <br />
                        {renderThresholdStatusIcons()}
                    </div>
                )

            case 'app_start_time':
                const startTimeProps = props as AppStartTimeProps
                return (
                    <div className={STYLES.text.tooltipContent}>
                        <p>
                            App start time = p95 {startTimeProps.launchType} launch time of selected app versions<br /><br />
                            Delta value = p95 {startTimeProps.launchType} launch time of selected app versions / p95 {startTimeProps.launchType} launch time of unselected app versions
                        </p>
                        <br />
                        <StatusIconRow
                            first
                            icon={<CheckCircle className={`${STYLES.icon.tooltipIcon} ${STYLES.icon.green}`} />}
                            text="Good (faster than or unchanged compared to unselected app versions)"
                        />
                        <StatusIconRow
                            icon={<AlertTriangle className={`${STYLES.icon.tooltipIcon} ${STYLES.icon.yellow}`} />}
                            text="Caution (slower than unselected app versions)"
                        />
                    </div>
                )

            case 'app_size':
                return (
                    <div className={STYLES.text.tooltipContent}>
                        <p>
                            Delta value = App size of selected app version - Average app size of unselected app versions
                        </p>
                        <br />
                        <StatusIconRow
                            first
                            icon={<CheckCircle className={`${STYLES.icon.tooltipIcon} ${STYLES.icon.green}`} />}
                            text="Good (size decreased or unchanged compared to unselected app versions)"
                        />
                        <StatusIconRow
                            icon={<AlertTriangle className={`${STYLES.icon.tooltipIcon} ${STYLES.icon.yellow}`} />}
                            text="Caution (size increased compared to unselected app versions)"
                        />
                    </div>
                )

            case 'app_adoption':
                const adoptionProps = props as AppAdoptionProps
                return (
                    <div className={STYLES.text.tooltipContent}>
                        <p>Adoption = (Sessions of selected app versions / Sessions of all app versions) * 100</p>
                        <div className={STYLES.layout.tooltipSpacer} />
                        <p>Selected Sessions = {adoptionProps.sessions}</p>
                        <p>Total Sessions = {adoptionProps.totalSessions}</p>
                    </div>
                )

            default:
                return null
        }
    }

    const showStatusIcon = () => {
        return ['crash_free_sessions', 'perceived_crash_free_sessions', 'anr_free_sessions', 'perceived_anr_free_sessions', 'app_start_time', 'app_size'].includes(type) && status === MetricsApiStatus.Success && !noData
    }

    const getStatusIconForType = () => {
        switch (type) {
            case 'crash_free_sessions':
            case 'perceived_crash_free_sessions':
            case 'anr_free_sessions':
            case 'perceived_anr_free_sessions':
                return getStatusIcon((props as CrashFreeSessionsProps | PerceivedCrashFreeSessionsProps | AnrFreeSessionsProps | PerceivedAnrFreeSessionsProps).value)
            case 'app_start_time':
                return getAppStartTimeStatusIcon((props as AppStartTimeProps).delta)
            case 'app_size':
                return getAppSizeStatusIcon((props as AppSizeProps).multiVersion, (props as AppSizeProps).deltaInBytes)
            default:
                return null
        }
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild className='transition-all'>
                <Card className={`${STYLES.layout.cardSize} hover:bg-muted/50`}>
                    <CardContent className={STYLES.layout.cardContent}>
                        {showStatusIcon() && (
                            <div className={STYLES.layout.statusIconPosition}>
                                {getStatusIconForType()}
                            </div>
                        )}

                        <div className={STYLES.layout.contentFlex}>
                            {renderCardContent()}
                        </div>
                    </CardContent>
                    <CardFooter className={STYLES.layout.cardFooter}>
                        <p className={STYLES.text.footerTitle}>{title}</p>
                    </CardFooter>
                </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start" className={STYLES.tooltip.content}>
                {renderTooltipContent()}
            </TooltipContent>
        </Tooltip>
    )
}

export default MetricsCard
