"use client"

import { EventTargetingRule, TraceTargetingRule, EventTargetingCollectionConfig, EventTargetingAttachmentConfig } from '@/app/api/api_calls'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/table'
import { formatDateToHumanReadableDate, formatDateToHumanReadableTime } from '@/app/utils/time_utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/tooltip'
import { Info } from 'lucide-react'

const getCollectionConfigDisplay = (collectionConfig: EventTargetingCollectionConfig): string => {
    switch (collectionConfig.mode) {
        case 'sample_rate':
            return `Collect all at ${collectionConfig.sample_rate}% sample rate`
        case 'timeline_only':
            return 'Collect with session timeline only'
        case 'disable':
            return 'Do not collect'
        default:
            return 'Unknown'
    }
}

const getAttachmentConfigDisplay = (attachmentConfig?: EventTargetingAttachmentConfig): string => {
    if (!attachmentConfig || attachmentConfig === 'none') {
        return ''
    } else if (attachmentConfig === 'layout_snapshot') {
        return 'With layout snapshot'
    } else if (attachmentConfig === 'screenshot') {
        return 'With screenshot'
    }
    return attachmentConfig
}

type RuleFilter = EventTargetingRule | TraceTargetingRule

interface RulesTableProps {
    rules: RuleFilter[]
    onRuleClick: (rule: RuleFilter) => void
}

export default function RulesTable({ rules, onRuleClick }: RulesTableProps) {
    if (rules.length === 0) {
        return null
    }

    return (
        <>
            <div className="py-6" />
            <div className="w-full flex items-center gap-2">
                <p className="font-display text-gray-500">Overrides</p>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Info className="w-4 h-4 text-gray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" className="font-display text-sm text-white fill-neutral-800 bg-neutral-800 whitespace-nowrap">
                        <div className="p-2">
                            <p>When a rule's condition matches, it overrides the default behavior.</p>
                        </div>
                    </TooltipContent>
                </Tooltip>
            </div>
            <div className="py-2" />
            <div className="overflow-hidden">
                <div className="overflow-x-auto">
                    <Table className="font-display">
                        <TableHeader className="sticky top-0 bg-white z-10">
                            <TableRow>
                                <TableHead className="w-[52%]">Rules</TableHead>
                                <TableHead className="w-[24%] text-center">Updated At</TableHead>
                                <TableHead className="w-[24%] text-center">Updated By</TableHead>
                            </TableRow>
                        </TableHeader>
                    </Table>
                </div>
                <div className="max-h-[400px] overflow-y-auto scrollbar-hide hover:scrollbar-default focus-within:scrollbar-default">
                    <Table className="font-display">
                        <TableBody>
                            {rules.map((dataFilter, idx) => (
                                <TableRow
                                    key={`${idx}-${dataFilter.id}`}
                                    className="font-body cursor-pointer hover:bg-yellow-200 focus-visible:border-yellow-200 select-none"
                                    onClick={() => onRuleClick(dataFilter)}
                                >
                                    <TableCell className="w-[52%] p-4">
                                        <p className='truncate select-none font-mono text-sm'>{dataFilter.rule}</p>
                                        <div className='py-1' />
                                        <p className='text-xs truncate text-gray-500 select-none'>{getCollectionConfigDisplay(dataFilter.collection_config)}</p>
                                        <p className='text-xs truncate text-gray-500 select-none'>{getAttachmentConfigDisplay('attachment_config' in dataFilter ? dataFilter.attachment_config : undefined)}</p>
                                    </TableCell>
                                    <TableCell className="w-[24%] text-center p-4">
                                        <p className='truncate select-none'>{formatDateToHumanReadableDate(dataFilter.updated_at)}</p>
                                        <div className='py-1' />
                                        <p className='text-xs truncate select-none'>{formatDateToHumanReadableTime(dataFilter.updated_at)}</p>
                                    </TableCell>
                                    <TableCell className="w-[24%] text-center p-4">
                                        <p className='truncate select-none'>{dataFilter.updated_by}</p>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </>
    )
}
