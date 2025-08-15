"use client"

import { useState } from 'react'
import { formatDateToHumanReadableDate, formatDateToHumanReadableTime } from '@/app/utils/time_utils'
import CreateRule from '@/app/components/create_rule'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/table'


interface SamplingRule {
  id: string
  expression: string
  enabled: boolean
  createdAt: string
  updatedAt: string
  createdBy: string
}

export default function Sampling({ params }: { params: { teamId: string } }) {

  // Multiple rules state management
  const [rules, setRules] = useState<SamplingRule[]>([
    {
      id: "1",
      expression: 'type == "exception" && exception.handled == false',
      enabled: true,
      createdAt: "2024-08-03T10:30:00Z",
      updatedAt: "2024-08-03T10:30:00Z",
      createdBy: "john.doe@company.com"
    },
    {
      id: "2",
      expression: 'type == "exception" && exception.handled == false && attribute.platform == "android"',
      enabled: false,
      createdAt: "2024-08-03T14:15:00Z",
      updatedAt: "2024-08-03T14:15:00Z",
      createdBy: "john.doe@company.com"
    }
  ])

  const handleRuleCreated = (newRule: any) => {
    const rule: SamplingRule = {
      id: Date.now().toString(),
      expression: newRule.expression,
      enabled: newRule.enabled,
      createdAt: newRule.createdAt,
      updatedAt: newRule.updatedAt,
      createdBy: newRule.createdBy
    }
    setRules([rule, ...rules])
  }


  const toggleRuleStatus = (ruleId: string) => {
    const now = new Date().toISOString()
    setRules(rules.map(rule => 
      rule.id === ruleId 
        ? { ...rule, enabled: !rule.enabled, updatedAt: now }
        : rule
    ))
  }



  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start">
      <div className="flex flex-row items-center gap-2 justify-between w-full">
        <p className="font-display text-4xl max-w-6xl text-center">Sampling</p>
        <CreateRule onSuccess={handleRuleCreated} />
      </div>
      <div className="py-4" />


      {/* Current Rules Table */}
        <div className="w-full">
          {rules.length === 0 ? (
            <p className="text-gray-500 font-body">No rules created yet</p>
          ) : (
            <Table className="font-display">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50%]">Rules</TableHead>
                  <TableHead className="w-[20%]">Created By</TableHead>
                  <TableHead className="w-[20%]">Updated At</TableHead>
                  <TableHead className="w-[10%]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id} className="font-body group">
                    <TableCell className="w-[50%]">
                      <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                        {rule.expression}
                      </code>
                    </TableCell>
                    <TableCell className="w-[20%] text-sm text-gray-600 font-body">
                      {rule.createdBy}
                    </TableCell>
                    <TableCell className="w-[20%] text-sm text-gray-400 font-body">
                      {formatDateToHumanReadableDate(rule.updatedAt)} at {formatDateToHumanReadableTime(rule.updatedAt)}
                    </TableCell>
                    <TableCell className="w-[10%]">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={() => toggleRuleStatus(rule.id)}
                          className="sr-only peer"
                        />
                        <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-200/75 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-400"></div>
                      </label>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
    </div>
  )
}