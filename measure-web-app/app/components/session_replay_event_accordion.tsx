'use client'

import { useState, useEffect } from 'react'
import FilterPill from './filter_pill'

type SessionReplayEventAccordionpProps = {
  children: React.ReactNode
  eventType: string
  threadName: string
  timestamp: string
  id: string
  active?: boolean
}

export default function SessionReplayEventAccordion({
  children,
  eventType,
  threadName,
  timestamp,
  id,
  active = false
}: SessionReplayEventAccordionpProps) {

  const [accordionOpen, setAccordionOpen] = useState<boolean>(false)

  useEffect(() => {
    setAccordionOpen(active)
  }, [])

  function getEventContainerColourFromType() {
    if (eventType === "exception" || eventType === "anr") {
      return "bg-red-200 hover:bg-red-300 active:bg-red-400 focus-visible:outline-red-300"
    }

    if (eventType.includes("gesture")) {
      return "bg-emerald-200 hover:bg-emerald-300 active:bg-emerald-400 focus-visible:outline-emerald-300"
    }

    if (eventType === "navigation") {
      return "bg-fuchsia-200 hover:bg-fuchsia-300 active:bg-fuchsia-400 focus-visible:outline-fuchsia-300"
    }

    if (eventType === "http") {
      return "bg-orange-200 hover:bg-orange-300 active:bg-orange-400 focus-visible:outline-orange-300"
    }

    return "bg-indigo-200 hover:bg-indigo-300 active:bg-indigo-400 focus-visible:outline-indigo-300"
  }

  return (
    <button className={`w-full p-4 outline-none border border-black rounded-md font-display ${getEventContainerColourFromType()}`}
      onClick={(e) => { e.preventDefault(); setAccordionOpen(!accordionOpen); }}
    >
      <div className="flex flex-row"
        id={`accordion-title-${id}`}>
        <p>{eventType}</p>
        <div className="flex grow" />
        <FilterPill title={threadName} />
        <div className="px-2" />
        <FilterPill title={`${new Date(timestamp).toLocaleDateString()}, ${new Date(timestamp).toLocaleTimeString()}:${new Date(timestamp).getMilliseconds()}`} />
      </div>
      <div
        id={`accordion-text-${id}`}
        role="region"
        aria-labelledby={`accordion-title-${id}`}
        className={`grid text-left text-sm font-sans overflow-hidden transition-all duration-300 ease-in-out ${accordionOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <p className="whitespace-pre-wrap p-4">
            {children}
          </p>
        </div>
      </div>
    </button>
  )
}