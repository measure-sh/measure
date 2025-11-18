"use client"

import { EventTargetingRule, TraceTargetingRule, SessionTargetingRule, CollectionMode } from '@/app/api/api_calls'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/table'
import { formatDateToHumanReadableDate, formatDateToHumanReadableTime } from '@/app/utils/time_utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/tooltip'
import { Info } from 'lucide-react'

type Rule = EventTargetingRule | TraceTargetingRule | SessionTargetingRule

interface RulesTableProps {
    rules: Rule[]
    tableType: 'session' | 'event' | 'trace'
    onRuleClick: (rule: Rule) => void
    showOverridesHeader?: boolean
}

const getCollectionConfigDisplay = (collectionMode: CollectionMode, samplingRate?: number): string => {
    switch (collectionMode) {
        case 'sampled':
            return `${samplingRate}% sampling rate`
        case 'timeline':
            return 'With session timeline only'
        case 'disabled':
            return 'Do not collect'
        default:
            return 'Unknown'
    }
}

const getAttachmentDisplay = (takeScreenshot: boolean, takeLayoutSnapshot: boolean): string => {
    const attachments: string[] = []

    if (takeScreenshot) {
        attachments.push('take screenshot')
    }

    if (takeLayoutSnapshot) {
        attachments.push('take layout snapshot')
    }

    return attachments.length > 0 ? attachments.join(', ') : ''
}

const getSamplingRateDisplay = (samplingRate: number): string => {
    return `${samplingRate}% sampling rate`
}

export default function RulesTable({ rules, tableType, onRuleClick, showOverridesHeader = true }: RulesTableProps) {
    const renderCollectionMode = (rule: Rule) => {
        switch (tableType) {
            case 'session':
                const sessionRule = rule as SessionTargetingRule
                return (
                    <p className="text-xs text-gray-500 truncate select-none">
                        {getSamplingRateDisplay(sessionRule.sampling_rate)}
                    </p>
                )

            case 'event':
                const eventRule = rule as EventTargetingRule
                const collectionDisplay = getCollectionConfigDisplay(eventRule.collection_mode, eventRule.sampling_rate)
                const attachmentDisplay = getAttachmentDisplay(eventRule.take_screenshot, eventRule.take_layout_snapshot)
                const fullDisplay = attachmentDisplay ? `${collectionDisplay}, ${attachmentDisplay}` : collectionDisplay

                return (
                    <p className="text-xs text-gray-500 truncate select-none">
                        {fullDisplay}
                    </p>
                )

            case 'trace':
                const traceRule = rule as TraceTargetingRule
                return (
                    <p className="text-xs text-gray-500 truncate select-none">
                        {getCollectionConfigDisplay(traceRule.collection_mode, traceRule.sampling_rate)}
                    </p>
                )
        }
    }

    const renderOverridesHeader = () => {
        if (!showOverridesHeader) return null

        return (
            <>
                <div className="py-6" />
                <div className="flex items-center gap-2 w-full">
                    <p className="text-gray-500 font-display">Overrides</p>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Info className="w-4 h-4 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent 
                            side="right" 
                            align="start" 
                            className="p-2 text-sm text-white font-display whitespace-nowrap bg-neutral-800 fill-neutral-800"
                        >
                            <p>When a rule's condition matches, it overrides the default behavior.</p>
                        </TooltipContent>
                    </Tooltip>
                </div>
                <div className="py-2" />
            </>
        )
    }

    const renderEmptyState = () => (
        <div className="text-sm text-gray-500 font-body">
            No rules created
        </div>
    )

    const renderRuleCreatedCell = (rule: Rule) => (
        <TableCell className="w-[20%] p-4 text-center">
            <p className="truncate select-none">{formatDateToHumanReadableDate(rule.created_at)}</p>
            <div className="py-1" />
            <p className="text-xs truncate select-none">{formatDateToHumanReadableTime(rule.created_at)}</p>
            <div className="py-1" />
            <p className="text-xs text-gray-500 truncate select-none">{rule.created_by ? rule.created_by : "Default"}</p>
        </TableCell>
    )

    const renderRuleModifiedCell = (rule: Rule) => (
        <TableCell className="w-[20%] p-4 text-center">
            {rule.updated_at ? (
                <>
                    <p className="truncate select-none">{formatDateToHumanReadableDate(rule.updated_at)}</p>
                    <div className="py-1" />
                    <p className="text-xs truncate select-none">{formatDateToHumanReadableTime(rule.updated_at)}</p>
                    {rule.updated_by && (
                        <>
                            <div className="py-1" />
                            <p className="text-xs text-gray-500 truncate select-none">{rule.updated_by}</p>
                        </>
                    )}
                </>
            ) : (
                <div>-</div>
            )}
        </TableCell>
    )

    const renderTableHeader = () => (
        <div className="overflow-x-auto">
            <Table className="font-display">
                <TableHeader className="sticky top-0 z-10 bg-white">
                    <TableRow>
                        <TableHead className="w-[60%]">Rule</TableHead>
                        <TableHead className="w-[20%] text-center">Created</TableHead>
                        <TableHead className="w-[20%] text-center">Modified</TableHead>
                    </TableRow>
                </TableHeader>
            </Table>
        </div>
    )

    const renderTableBody = () => (
        <div className="max-h-[400px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-gray-300 focus-within:[&::-webkit-scrollbar-thumb]:bg-gray-300">
            <Table className="font-display">
                <TableBody>
                    {rules.map((rule, idx) => (
                        <TableRow
                            key={`${idx}-${rule.id}`}
                            className="cursor-pointer select-none font-body hover:bg-yellow-200 focus-visible:border-yellow-200"
                            onClick={() => onRuleClick(rule)}
                        >
                            <TableCell className="w-[60%] p-4">
                                <p className="truncate select-none">{rule.name}</p>
                                <div className="py-1" />
                                {renderCollectionMode(rule)}
                            </TableCell>
                            {renderRuleCreatedCell(rule)}
                            {renderRuleModifiedCell(rule)}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )

    const renderTable = () => (
        <div className="overflow-hidden">
            {renderTableHeader()}
            {renderTableBody()}
        </div>
    )

    return (
        <>
            {renderOverridesHeader()}
            {rules.length === 0 ? renderEmptyState() : renderTable()}
        </>
    )
}