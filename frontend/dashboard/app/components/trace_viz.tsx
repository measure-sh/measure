"use client"

import { DateTime } from 'luxon'
import React, { useState } from 'react'
import { formatDateToHumanReadableDateTime, formatMillisToHumanReadable } from '../utils/time_utils'

enum SpanVisibility {
  Expanded,
  Collapsed,
  Hidden
}

interface Checkpoint {
  name: string
  timestamp: string
  leftOffset?: number
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
  leftOffset?: number
  width?: number
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
  const vizWidth = 800
  const margin = 8

  const orderedSpans: Span[] = []
  const addSpanAndChildren = (span: Span, depth: number) => {
    span.depth = depth

    const spanStart = DateTime.fromISO(span.start_time)
    span.leftOffset = (spanStart.diff(traceStartTime).milliseconds / inputTrace.duration) * vizWidth + margin
    span.width = (span.duration / inputTrace.duration) * vizWidth - margin * 2
    span.visibility = SpanVisibility.Expanded

    span.checkpoints?.forEach((c) => {
      const checkPointTime = DateTime.fromISO(c.timestamp)
      c.leftOffset = (checkPointTime.diff(traceStartTime).milliseconds / inputTrace.duration) * vizWidth + margin - span.leftOffset!
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

  const keyStyle = "text-gray-400 w-1/3 select-none"
  const valueStyle = "w-2/3 pl-2"

  const toggleSpanVisibility = (targetSpanId: string) => {
    const updatedSpans = new Map<string, Span>()

    // Helper function to recursively update visibility of children
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

        // Recursively update children
        updateChildrenVisibility(child.span_id, newVisibility)
      }
    }

    // Update the target span's visibility
    const targetSpan = trace.spans.find(s => s.span_id === targetSpanId)!

    const newTargetVisibility =
      targetSpan.visibility === SpanVisibility.Expanded
        ? SpanVisibility.Collapsed
        : SpanVisibility.Expanded

    const updatedTargetSpan = { ...targetSpan, visibility: newTargetVisibility }
    updatedSpans.set(targetSpanId, updatedTargetSpan)

    // Update children visibility based on the new target visibility
    updateChildrenVisibility(targetSpanId, newTargetVisibility)

    // Create a new trace with updated spans
    const newSpans = trace.spans.map(span =>
      updatedSpans.has(span.span_id) ? updatedSpans.get(span.span_id)! : span
    )

    const updatedTrace = { ...trace, spans: newSpans }
    setTrace(updatedTrace)
  }

  return (
    <div className="flex flex-col w-[1100px] h-[600px] relative font-body text-black border border-black rounded-md overflow-hidden">

      {/* timing indicator */}
      <div className='w-[800px] ml-[300px] flex flex-row justify-between p-[8px]'>
        <div className='flex flex-col items-start'>
          <p className='text-[10px]'>0ms</p>
          <div className='w-[0.5px] h-2 bg-neutral-950' />
        </div>
        <div className='flex flex-col items-start'>
          <p className='text-[10px]'>{(trace.duration * 0.2 / 1000).toPrecision(2)}s</p>
          <div className='w-[0.5px] h-2 bg-neutral-950' />
        </div>
        <div className='flex flex-col items-start'>
          <p className='text-[10px]'>{(trace.duration * 0.4 / 1000).toPrecision(2)}s</p>
          <div className='w-[0.5px] h-2 bg-neutral-950' />
        </div>
        <div className='flex flex-col items-start'>
          <p className='text-[10px]'>{(trace.duration * 0.6 / 1000).toPrecision(2)}s</p>
          <div className='w-[0.5px] h-2 bg-neutral-950' />
        </div>
        <div className='flex flex-col items-start'>
          <p className='text-[10px]'>{(trace.duration * 0.8 / 1000).toPrecision(2)}s</p>
          <div className='w-[0.5px] h-2 bg-neutral-950' />
        </div>
        <div className='flex flex-col items-start'>
          <p className='text-[10px]'>{(trace.duration / 1000).toPrecision(2)}s</p>
          <div className='w-[0.5px] h-2 bg-neutral-950' />
        </div>
      </div>

      {/* Panel */}
      <div
        className={`absolute overflow-auto z-50 top-0 left-0 h-full w-1/4 bg-neutral-800 p-4 text-white text-xs break-words transform transition-transform duration-300 ease-in-out ${selectedSpan !== undefined ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {selectedSpan !== undefined &&
          <div>
            <button className="outline-none select-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-white hover:border-black active:border-black focus-visible:border-black hover:text-black active:text-black focus-visible:text-black rounded-md font-display transition-colors duration-100 py-2 px-4"
              onClick={() => {
                setSelectedSpan(undefined)
                setSelectedCheckpoint(undefined)
              }}>
              Close
            </button>
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
              <p className={`${valueStyle} ${selectedSpan.status === 1 ? "text-green-300" : selectedSpan.status === 2 ? "text-red-300" : ""}`}> {selectedSpan.status === 0 ? "Unset" : selectedSpan.status === 1 ? "Okay" : "Error"}</p>
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
              <div className={`flex flex-col mt-1 p-1 pl-4 ${selectedCheckpoint === checkpoint ? "bg-neutral-950" : "hover:bg-neutral-950"}`}
                key={checkpoint.name}
                onClick={() => setSelectedCheckpoint(checkpoint)}>
                <div className='flex flex-row mt-1'>
                  <p className={keyStyle}>Name</p>
                  <p className={valueStyle}> {checkpoint.name}</p>
                </div>
                <div className='flex flex-row mt-1'>
                  <p className={keyStyle}>Time</p>
                  <p className={valueStyle}> {formatDateToHumanReadableDateTime(checkpoint.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        }
      </div>

      <div className="flex flex-row w-full h-full items-start pt-4 pb-8 overflow-x-hidden overflow-y-auto">

        {/* span names column */}
        <div className='flex flex-col w-[300px] pl-2 overflow-x-auto select-none'>
          {trace.spans.filter((span) => span.visibility !== SpanVisibility.Hidden).map((span, index) => (
            <div key={span.span_id} className={`flex flex-row items-center h-12 w-fit min-w-[300px] ${index % 2 === 0 ? 'bg-zinc-50' : ''} ${span.numberOfChildren! > 0 ? 'hover:bg-zinc-100' : ''}`} onClick={() => toggleSpanVisibility(span.span_id)} >
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
              <p className={`text-xs mb-1 text-nowrap ml-2`}>{span.span_name}</p>
              <p className={`text-[8px] ml-2 mr-2 text-gray-400`}>{span.visibility === SpanVisibility.Expanded && span.numberOfChildren! > 0 ? "\u02c5" : span.visibility === SpanVisibility.Collapsed && span.numberOfChildren! > 0 ? "\u02c3" : ""}</p>
            </div>
          ))}
        </div>

        {/* spans column */}
        <div className='flex flex-col w-[800px] select-none'>
          {trace.spans.filter((span) => span.visibility !== SpanVisibility.Hidden).map((span, spanIndex) => (
            <div key={span.span_id} className={`w-full h-12 ${spanIndex % 2 === 0 ? 'bg-zinc-50' : ''}`}>
              {/* span and duration container */}
              <div>

                {/* duration */}
                <p className={`text-xs mt-1 pr-1 overflow-x-auto`}
                  style={{
                    marginLeft: `${span.leftOffset}px`,
                  }}>
                  {span.duration}ms
                </p>

                {/* span */}
                <div style={{
                  marginLeft: `${span.leftOffset}px`,
                  width: `${span.width}px`,
                }}
                  className={`h-3 mt-1 ${bgSpanColorMap.get(span.span_id)} ${span === selectedSpan ? "bg-neutral-800 hover:bg-neutral-950" : ""} select-none`}
                  onClick={() => {
                    if (selectedSpan === undefined || selectedSpan !== span) {
                      setSelectedSpan(span)
                    } else {
                      setSelectedSpan(undefined)
                      setSelectedCheckpoint(undefined)
                    }
                  }}
                >
                </div>
              </div>

              {/* checkpoints */}
              <div style={{
                marginLeft: `${span.leftOffset}px`,
                width: `${span.width}px`,
              }} className="relative">
                {span.checkpoints?.map((checkpoint, _) => (
                  <div
                    key={span.span_id + checkpoint.name}
                    style={{
                      left: `${checkpoint.leftOffset}px`,
                      top: '0px'
                    }} className={`w-0.5 h-2 rounded-full absolute mt-0.5 mb-0.5 ${bgCheckPointColorMap.get(span.span_id)} ${checkpoint === selectedCheckpoint ? "bg-neutral-800 hover:bg-neutral-950" : ""}`}
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
                    }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div >
    </div >
  )
}

export default TraceViz