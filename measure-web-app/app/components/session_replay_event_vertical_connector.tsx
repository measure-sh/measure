'use client'

import { formatMillisToHumanReadable } from "../utils/time_utils";

type SessionReplayEventVerticalConnectorProps = {
  milliseconds: number
}

export default function SessionReplayEventVerticalConnector({
  milliseconds
}: SessionReplayEventVerticalConnectorProps) {


  function getDividerHeightInPx() {
    return milliseconds * 3;
  }

  return (
    <div className="flex flex-row w-full items-center justify-center">
      <div className={`bg-gray-200 w-0.5`} style={{ height: `${getDividerHeightInPx()}px` }} />
      <div className="px-2" />
      <p className="text-sm font-sans">{formatMillisToHumanReadable(milliseconds)}</p>
    </div>
  )
}