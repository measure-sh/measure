"use client"

import { DateTime } from 'luxon'
import React, { useState } from 'react'
import { formatDateToHumanReadableDateTime, formatMillisToHumanReadable } from '../utils/time_utils'
import { Button } from './button'

enum SpanVisibility {
  Expanded,
  Collapsed,
  Hidden
}

interface Checkpoint {
  name: string
  timestamp: string
  leftPercent?: number
}

interface Span {
  span_name: string
  span_id: string
  parent_id: string
  status: number
  start_time: string
  end_time: string
  duration: number
  thread_name: string
  depth?: number
  numberOfChildren?: number
  leftPercent?: number
  widthPercent?: number
  visibility?: SpanVisibility
  user_defined_attributes?: Map<string, string> | null
  checkpoints: Checkpoint[] | null
}

interface Trace {
  app_id: string
  trace_id: string
  session_id: string
  user_id: string
  start_time: string
  end_time: string
  duration: number
  app_version: string
  os_version: string
  device_model: string
  device_manufacturer: string
  network_type: string
  spans: Span[]
}

interface TraceVizProps {
  inputTrace: Trace
}

const bgLineColors = [
  'bg-blue-300',
  'bg-green-300',
  'bg-purple-300',
  'bg-pink-300',
  'bg-indigo-300',
  'bg-orange-300',
]

const bgSpanColors = [
  'bg-blue-200 hover:bg-blue-300',
  'bg-green-200 hover:bg-green-300',
  'bg-purple-200 hover:bg-purple-300',
  'bg-pink-200 hover:bg-pink-300',
  'bg-indigo-200 hover:bg-indigo-300',
  'bg-orange-200 hover:bg-orange-300',
]

const bgCheckPointColors = [
  'bg-blue-400 hover:bg-blue-500',
  'bg-green-400 hover:bg-green-500',
  'bg-purple-400 hover:bg-purple-500',
  'bg-pink-400 hover:bg-pink-500',
  'bg-indigo-400 hover:bg-indigo-500',
  'bg-orange-400 hover:bg-orange-500',
]

const borderColors = [
  'border-blue-300',
  'border-green-300',
  'border-purple-300',
  'border-pink-300',
  'border-indigo-300',
  'border-orange-300',
]

const TraceViz: React.FC<TraceVizProps> = ({ inputTrace }) => {
  const marginPercent = 0.5 // 0.5% margin on each side

  const childrenMap = new Map<string, Span[]>()
  inputTrace.spans.forEach(span => {
    if (span.parent_id) {
      if (!childrenMap.has(span.parent_id)) {
        childrenMap.set(span.parent_id, [])
      }
      childrenMap.get(span.parent_id)!.push(span)
    }
  })

  const rootSpans = inputTrace.spans.filter(span => !span.parent_id)

  const bgLineColorMap = new Map<string, string>()
  const bgCheckPointColorMap = new Map<string, string>()
  const bgSpanColorMap = new Map<string, string>()
  const borderColorMap = new Map<string, string>()
  let colorIndex = 0

  const assignColors = (span: Span, colorIndex: number) => {
    bgSpanColorMap.set(span.span_id, bgSpanColors[colorIndex % bgSpanColors.length])
    bgCheckPointColorMap.set(span.span_id, bgCheckPointColors[colorIndex % bgCheckPointColors.length])
    bgLineColorMap.set(span.span_id, bgLineColors[colorIndex % bgLineColors.length])
    borderColorMap.set(span.span_id, borderColors[colorIndex % borderColors.length])
    const children = childrenMap.get(span.span_id) || []
    children.forEach(child => assignColors(child, colorIndex))
  }

  rootSpans.forEach(rootSpan => {
    assignColors(rootSpan, colorIndex)
    colorIndex++

    if (colorIndex > bgLineColors.length) {
      colorIndex = 0
    }
  })

  const traceStartTime = DateTime.fromISO(inputTrace.start_time)

  const orderedSpans: Span[] = []
  const addSpanAndChildren = (span: Span, depth: number) => {
    span.depth = depth

    const spanStart = DateTime.fromISO(span.start_time)
    span.leftPercent = (spanStart.diff(traceStartTime).milliseconds / inputTrace.duration) * 100 + marginPercent
    span.widthPercent = Math.max((span.duration / inputTrace.duration) * 100 - marginPercent * 2, 1) // min 1%
    span.visibility = SpanVisibility.Expanded

    span.checkpoints?.forEach((c) => {
      const checkPointTime = DateTime.fromISO(c.timestamp)
      const checkpointPercent = (checkPointTime.diff(traceStartTime).milliseconds / inputTrace.duration) * 100 + marginPercent
      c.leftPercent = ((checkpointPercent - span.leftPercent!) / span.widthPercent!) * 100
    })

    orderedSpans.push(span)

    const children = childrenMap.get(span.span_id) || []
    span.numberOfChildren = children.length
    children
      .sort((a, b) => DateTime.fromISO(a.start_time).toMillis() - DateTime.fromISO(b.start_time).toMillis())
      .forEach(child => addSpanAndChildren(child, depth + 1))
  }

  rootSpans
    .sort((a, b) => DateTime.fromISO(a.start_time).toMillis() - DateTime.fromISO(b.start_time).toMillis())
    .forEach(rootSpan => addSpanAndChildren(rootSpan, 1))

  inputTrace.spans = orderedSpans

  const [trace, setTrace] = useState(inputTrace)
  const [selectedSpan, setSelectedSpan] = useState<Span>()
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<Checkpoint>()

  const keyStyle = "text-accent-foreground/60 w-1/4 select-none"
  const valueStyle = "w-3/4 pl-1 text-start"

  const toggleSpanVisibility = (targetSpanId: string) => {
    const updatedSpans = new Map<string, Span>()

    function updateChildrenVisibility(
      parentId: string,
      parentVisibility: SpanVisibility
    ) {
      const children = childrenMap.get(parentId) || []
      const newVisibility =
        parentVisibility === SpanVisibility.Expanded
          ? SpanVisibility.Expanded
          : SpanVisibility.Hidden

      for (const child of children) {
        const updatedChild = { ...child, visibility: newVisibility }
        updatedSpans.set(child.span_id, updatedChild)
        updateChildrenVisibility(child.span_id, newVisibility)
      }
    }

    const targetSpan = trace.spans.find(s => s.span_id === targetSpanId)!

    const newTargetVisibility =
      targetSpan.visibility === SpanVisibility.Expanded
        ? SpanVisibility.Collapsed
        : SpanVisibility.Expanded

    const updatedTargetSpan = { ...targetSpan, visibility: newTargetVisibility }
    updatedSpans.set(targetSpanId, updatedTargetSpan)

    updateChildrenVisibility(targetSpanId, newTargetVisibility)

    const newSpans = trace.spans.map(span =>
      updatedSpans.has(span.span_id) ? updatedSpans.get(span.span_id)! : span
    )

    const updatedTrace = { ...trace, spans: newSpans }
    setTrace(updatedTrace)
  }

  return (
    <div className="flex flex-col w-full h-[600px] relative font-body text-foreground rounded-md overflow-hidden">

      {/* Panel */}
      <div
        className={`absolute overflow-auto z-50 top-0 left-0 h-full w-64 md:w-72 lg:w-80 bg-accent p-4 text-accent-foreground text-xs break-words transform transition-transform duration-300 ease-in-out ${selectedSpan !== undefined ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {selectedSpan !== undefined &&
          <div>
            <Button variant="secondary" className="py-2 px-4"
              onClick={() => {
                setSelectedSpan(undefined)
                setSelectedCheckpoint(undefined)
              }}>
              Close
            </Button>
            <div className='flex flex-row mt-4'>
              <p className={keyStyle}>Span Name</p>
              <p className={valueStyle}> {selectedSpan.span_name}</p>
            </div>
            <div className='flex flex-row mt-1'>
              <p className={keyStyle}>Span Id</p>
              <p className={valueStyle}> {selectedSpan.span_id}</p>
            </div>
            <div className='flex flex-row mt-1'>
              <p className={keyStyle}>Start Time</p>
              <p className={valueStyle}> {formatDateToHumanReadableDateTime(selectedSpan.start_time)}</p>
            </div>
            <div className='flex flex-row mt-1'>
              <p className={keyStyle}>End Time</p>
              <p className={valueStyle}> {formatDateToHumanReadableDateTime(selectedSpan.end_time)}</p>
            </div>
            <div className='flex flex-row mt-1'>
              <p className={keyStyle}>Duration</p>
              <p className={valueStyle}> {formatMillisToHumanReadable(selectedSpan.duration)}</p>
            </div>
            <div className='flex flex-row mt-1'>
              <p className={keyStyle}>Parent Id</p>
              <p className={valueStyle}> {selectedSpan.parent_id ? selectedSpan.parent_id : "--"}</p>
            </div>
            <div className='flex flex-row mt-1'>
              <p className={keyStyle}>Thread Name</p>
              <p className={valueStyle}> {selectedSpan.thread_name}</p>
            </div>
            <div className='flex flex-row mt-1'>
              <p className={keyStyle}>Span Status</p>
              <p className={`${valueStyle} ${selectedSpan.status === 1 ? "text-green-600 dark:text-green-500" : selectedSpan.status === 2 ? "text-red-600 dark:text-red-400" : ""}`}> {selectedSpan.status === 0 ? "Unset" : selectedSpan.status === 1 ? "Okay" : "Error"}</p>
            </div>
            {selectedSpan.user_defined_attributes !== null && selectedSpan.user_defined_attributes !== undefined && Object.entries(selectedSpan.user_defined_attributes!).map(([attrKey, attrValue]) => (
              <div className="flex flex-row mt-1" key={attrKey}>
                <p className={keyStyle}>{attrKey}</p>
                <p className={valueStyle}>{attrValue?.toString()}</p>
              </div>
            ))}
            <div className='flex flex-row mt-1'>
              <p className={keyStyle}>Checkpoints</p>
              <p className={`${valueStyle}`}>{selectedSpan.checkpoints !== null && selectedSpan.checkpoints.length > 0 ? ": " : ": []"}</p>
            </div>
            {selectedSpan.checkpoints?.map((checkpoint, _) => (
              <button className={`flex flex-col group mt-1 py-2 px-2 w-full rounded-md focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] ${selectedCheckpoint === checkpoint ? "bg-background" : "hover:bg-background"}`}
                key={checkpoint.name}
                onClick={() => setSelectedCheckpoint(checkpoint)}>
                <div className='flex flex-row mt-1'>
                  <p className={`${keyStyle} ${selectedCheckpoint === checkpoint ? "text-foreground dark:text-accent-foreground/60" : "group-hover:text-foreground text-accent-foreground/60 dark:group-hover:text-accent-foreground/60"}`}>Name</p>
                  <p className={`${valueStyle} ${selectedCheckpoint === checkpoint ? "text-foreground" : "group-hover:text-foreground text-accent-foreground"}`}> {checkpoint.name}</p>
                </div>
                <div className='flex flex-row mt-2'>
                  <p className={`${keyStyle} ${selectedCheckpoint === checkpoint ? "text-foreground dark:text-accent-foreground/60" : "group-hover:text-foreground text-accent-foreground/60 dark:group-hover:text-accent-foreground/60"}`}>Time</p>
                  <p className={`${valueStyle} ${selectedCheckpoint === checkpoint ? "text-foreground" : "group-hover:text-foreground text-accent-foreground"}`}> {formatDateToHumanReadableDateTime(checkpoint.timestamp)}</p>
                </div>
              </button>
            ))}
          </div>
        }
      </div>

      <div className="flex flex-row w-full h-full items-start pt-4 pb-8 bg-background text-foreground overflow-x-hidden overflow-y-auto">

        {/* span names column */}
        <div className='flex flex-col w-1/4 min-w-[200px] max-w-[300px] pl-2 mt-12 overflow-x-auto select-none shrink-0'>
          {trace.spans.filter((span) => span.visibility !== SpanVisibility.Hidden).map((span, index) => (
            <button key={span.span_id} className={`flex flex-row items-center h-12 w-fit min-w-full focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] ${index % 2 === 0 ? 'bg-secondary' : ''} ${span.numberOfChildren! > 0 ? index % 2 === 0 ? 'hover:bg-secondary/50' : 'hover:bg-accent' : ''}`}
              onClick={() => toggleSpanVisibility(span.span_id)} >
              {/* vertical connecting line */}
              {Array.from({ length: span.depth || 0 }).map((_, index) => (
                <div key={span.span_id + index} className={`h-full w-[0.5px] ml-3.5 ${bgLineColorMap.get(span.span_id)}`} />
              ))}
              {/* horizontal connecting line */}
              <div className={`h-[0.5px] w-2.5 ${bgLineColorMap.get(span.span_id)}`} />

              {/* connecting circle container */}
              <div className='flex flex-col items-center'>
                {/* connecting circle vertical invisible line for positioning */}
                {span.numberOfChildren! > 0 && <div className={`h-5 w-[0.5px] invisible`} />}

                {/* connecting circle */}
                <div className={`h-2 w-2 rounded-full ${bgLineColorMap.get(span.span_id)}`} />

                {/* connecting circle vertical visible line */}
                {span.numberOfChildren! > 0 && <div className={`h-5 w-[0.5px] ${bgLineColorMap.get(span.span_id)}`} />}
              </div>
              <p className={`text-[10px] border py-0.1 px-1 ml-1 rounded-[2px] ${borderColorMap.get(span.span_id)}`}>{span.numberOfChildren!} </p>
              <p className={`text-xs mb-1 text-nowrap ml-2 truncate max-w-[150px]`}>{span.span_name}</p>
              <p className={`text-[8px] ml-2 mr-2 text-muted-foreground`}>{span.visibility === SpanVisibility.Expanded && span.numberOfChildren! > 0 ? "\u02c5" : span.visibility === SpanVisibility.Collapsed && span.numberOfChildren! > 0 ? "\u02c3" : ""}</p>
            </button>
          ))}
        </div>

        {/* spans column */}
        <div className="flex flex-col w-full select-none">

          {/* timing indicator - values */}
          <div className='w-full flex flex-row justify-between px-2 pt-2'>
            <p className='text-[10px] truncate'>{formatMillisToHumanReadable(0)}</p>
            <p className='text-[10px] truncate'>{formatMillisToHumanReadable(trace.duration * 0.2)}</p>
            <p className='text-[10px] truncate'>{formatMillisToHumanReadable(trace.duration * 0.4)}</p>
            <p className='text-[10px] truncate'>{formatMillisToHumanReadable(trace.duration * 0.6)}</p>
            <p className='text-[10px] truncate'>{formatMillisToHumanReadable(trace.duration * 0.8)}</p>
            <p className='text-[10px] truncate'>{formatMillisToHumanReadable(trace.duration)}</p>
          </div>

          {/* timing indicator - markers */}
          <div className='w-full flex flex-row justify-between px-2 pt-2 pb-[9px]'>
            <div className='w-[0.5px] h-2 bg-foreground' />
            <div className='w-[0.5px] h-2 bg-foreground' />
            <div className='w-[0.5px] h-2 bg-foreground' />
            <div className='w-[0.5px] h-2 bg-foreground' />
            <div className='w-[0.5px] h-2 bg-foreground' />
            <div className='w-[0.5px] h-2 bg-foreground' />
          </div>

          {trace.spans.filter((span) => span.visibility !== SpanVisibility.Hidden).map((span, spanIndex) => (
            <div key={span.span_id} className={`relative w-full h-12 ${spanIndex % 2 === 0 ? 'bg-secondary' : ''}`}>
              {/* duration label */}
              <p
                className="absolute text-xs mt-1 whitespace-nowrap"
                style={{ left: `${span.leftPercent}%` }}
              >
                {formatMillisToHumanReadable(span.duration)}
              </p>

              {/* span bar */}
              <button
                className={`absolute top-6 h-3 min-w-[8px] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] ${span === selectedSpan ? "bg-primary hover:bg-primary" : bgSpanColorMap.get(span.span_id)} select-none`}
                style={{
                  left: `${span.leftPercent}%`,
                  width: `${span.widthPercent}%`,
                }}
                onClick={() => {
                  if (selectedSpan === undefined || selectedSpan !== span) {
                    setSelectedSpan(span)
                  } else {
                    setSelectedSpan(undefined)
                    setSelectedCheckpoint(undefined)
                  }
                }}
              />

              {/* checkpoints container */}
              <div
                className="absolute top-9 h-2"
                style={{
                  left: `${span.leftPercent}%`,
                  width: `${span.widthPercent}%`,
                }}
              >
                {span.checkpoints?.map((checkpoint) => (
                  <button
                    key={span.span_id + checkpoint.name}
                    className={`absolute w-0.5 h-2 rounded-full mt-0.5 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] ${checkpoint === selectedCheckpoint ? "bg-primary hover:bg-primary" : bgCheckPointColorMap.get(span.span_id)}`}
                    style={{ left: `${checkpoint.leftPercent}%` }}
                    onClick={() => {
                      if (selectedCheckpoint === undefined) {
                        setSelectedSpan(span)
                        setSelectedCheckpoint(checkpoint)
                      } else if (selectedCheckpoint === checkpoint) {
                        setSelectedSpan(undefined)
                        setSelectedCheckpoint(undefined)
                      } else {
                        setSelectedSpan(span)
                        setSelectedCheckpoint(checkpoint)
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default TraceViz