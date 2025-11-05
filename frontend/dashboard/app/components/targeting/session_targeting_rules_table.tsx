"use client"

import { SessionTargetingRule } from '@/app/api/api_calls'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/table'
import { formatDateToHumanReadableDate, formatDateToHumanReadableTime } from '@/app/utils/time_utils'
import Paginator from '@/app/components/paginator'

const getSamplingRateDisplay = (samplingRate: number): string => {
    return `${samplingRate}% sampling rate`
}

interface SessionTargetingRulesTableProps {
    rules: SessionTargetingRule[]
    onRuleClick: (rule: SessionTargetingRule) => void
    prevEnabled: boolean
    nextEnabled: boolean
    onNext: () => void
    onPrev: () => void
    showPaginator: boolean
}

export default function SessionTargetingRulesTable({ rules, onRuleClick, prevEnabled, nextEnabled, onNext, onPrev, showPaginator }: SessionTargetingRulesTableProps) {
    if (rules.length === 0) {
        return null
    }

    return (
        <>
            <div className="w-full flex items-center justify-end">
                {showPaginator && (
                    <Paginator
                        prevEnabled={prevEnabled}
                        nextEnabled={nextEnabled}
                        displayText=""
                        onNext={onNext}
                        onPrev={onPrev}
                    />
                )}
            </div>
            <div className="py-4" />
            <Table className="font-display">
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[52%]">Rule</TableHead>
                        <TableHead className="w-[24%] text-center">Updated At</TableHead>
                        <TableHead className="w-[24%] text-center">Updated By</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rules.map((rule, idx) => (
                        <TableRow
                            key={`${idx}-${rule.id}`}
                            className="font-body cursor-pointer hover:bg-yellow-200 focus-visible:border-yellow-200 select-none"
                            onClick={() => onRuleClick(rule)}
                        >
                            <TableCell className="w-[60%] p-4">
                                <p className='truncate select-none font-mono text-sm'>{rule.rule}</p>
                                <div className='py-1' />
                                <p className='text-xs truncate text-gray-500 select-none'>{getSamplingRateDisplay(rule.sampling_rate)}</p>
                            </TableCell>
                            <TableCell className="w-[20%] text-center p-4">
                                <p className='truncate select-none'>{formatDateToHumanReadableDate(rule.updated_at)}</p>
                                <div className='py-1' />
                                <p className='text-xs truncate select-none'>{formatDateToHumanReadableTime(rule.updated_at)}</p>
                            </TableCell>
                            <TableCell className="w-[20%] text-center p-4">
                                <p className='truncate select-none'>{rule.updated_by}</p>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </>
    )
}
