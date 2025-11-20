"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { ExceptionGroupCommonPathApiStatus, ExceptionsType, fetchExceptionGroupCommonPathFromServer } from '../api/api_calls'
import { Badge } from './badge'
import LoadingSpinner from './loading_spinner'
import { Slider } from './slider'

interface ExceptionGroupCommonPathProps {
  type: ExceptionsType,
  appId: string,
  groupId: string,
}

type ExceptionGroupCommonPath = {
  sessions_analyzed: number;
  steps: Array<{
    description: string;
    thread_name: string;
    confidence_pct: number;
  }>;
}

const ExceptionGroupCommonPath: React.FC<ExceptionGroupCommonPathProps> = ({ type, appId, groupId }) => {
  const [exceptionGroupCommonPathApiStatus, setExceptionGroupCommonPathApiStatus] = useState(ExceptionGroupCommonPathApiStatus.Loading)
  const [exceptionsGroupCommonPath, setExceptionGroupCommonPath] = useState<ExceptionGroupCommonPath>()
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(80)

  const getExceptionGroupCommonPath = async () => {
    setExceptionGroupCommonPathApiStatus(ExceptionGroupCommonPathApiStatus.Loading)

    const result = await fetchExceptionGroupCommonPathFromServer(type, appId, groupId)

    switch (result.status) {
      case ExceptionGroupCommonPathApiStatus.Error:
        setExceptionGroupCommonPathApiStatus(ExceptionGroupCommonPathApiStatus.Error)
        break
      case ExceptionGroupCommonPathApiStatus.Success:
        setExceptionGroupCommonPathApiStatus(ExceptionGroupCommonPathApiStatus.Success)
        setExceptionGroupCommonPath(result.data)
        break
    }
  }

  useEffect(() => {
    getExceptionGroupCommonPath()
  }, [type, groupId, appId])

  // Filter steps based on confidence threshold
  const filteredSteps = useMemo(() => {
    if (!exceptionsGroupCommonPath?.steps) return []
    return exceptionsGroupCommonPath.steps
      .filter(step => step.confidence_pct >= confidenceThreshold)
  }, [exceptionsGroupCommonPath, confidenceThreshold])

  return (
    <div className="flex flex-col font-body w-full">
      <p className="text-3xl">
        Common Path{" "}
        <sup>
          <Badge variant="outline" className='select-none'>Beta</Badge>
        </sup>
      </p>
      {exceptionGroupCommonPathApiStatus === ExceptionGroupCommonPathApiStatus.Loading && <div className='py-4'><LoadingSpinner /></div>}
      {exceptionGroupCommonPathApiStatus === ExceptionGroupCommonPathApiStatus.Error && <p className="font-display py-4">Error fetching common path, please refresh page to try again</p>}
      {exceptionGroupCommonPathApiStatus === ExceptionGroupCommonPathApiStatus.Success &&
        <div className="flex flex-col w-full">
          {/* Confidence Filter */}
          <div className='py-4' />
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-500">Showing events that are common in at least: <span className='font-semibold'>{confidenceThreshold}%</span> of analyzed sessions</label>
              <span className="text-xs text-gray-500">Analyzed from latest {exceptionsGroupCommonPath?.sessions_analyzed} sessions | {filteredSteps.length} of {exceptionsGroupCommonPath?.steps.length} steps</span>
            </div>
            <Slider
              value={[confidenceThreshold]}
              onValueChange={(value) => setConfidenceThreshold(value[0])}
              min={1}
              max={100}
              step={1}
              className="w-full"
            />
          </div>

          <div className='py-4' />
          <div className='w-full bg-gray-50 px-4 py-4 h-[24rem] overflow-y-auto'>
            {filteredSteps.length === 0 ? (
              <p className="text-center text-sm text-gray-600 w-full py-24">No events are common in at least {confidenceThreshold}% of analyzed sessions</p>
            ) : (
              <ol className="list-decimal list-outside space-y-4 ml-8">
                {filteredSteps.map((stepInfo, index) => (
                  <li key={index} className="pl-2">
                    <span>{stepInfo.description}</span>
                    <p className="text-sm text-gray-600 py-1">Thread: {stepInfo.thread_name} | Occurs in {stepInfo.confidence_pct}% of analyzed sessions</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      }
    </div>
  )
}

export default ExceptionGroupCommonPath