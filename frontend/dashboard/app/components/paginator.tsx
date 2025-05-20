"use client"

import { Button } from "./button"

interface PaginatorProps {
  displayText: string
  prevEnabled: boolean
  nextEnabled: boolean
  onNext: () => void
  onPrev: () => void
}

export enum PaginationDirection {
  Forward,
  Backward,
  None
}

const Paginator: React.FC<PaginatorProps> = ({ displayText, prevEnabled, nextEnabled, onNext, onPrev }) => {
  return (
    <div className="flex flex-row items-center">
      <Button
        variant="outline"
        className="font-display border border-black rounded-md select-none"
        disabled={!prevEnabled}
        onClick={onPrev}
      >
        Previous
      </Button>
      <p className="font-display mx-4">{displayText}</p>
      <Button
        variant="outline"
        className="font-display border border-black rounded-md select-none"
        disabled={!nextEnabled}
        onClick={onNext}
      >
        Next
      </Button>
    </div>
  )
}

export default Paginator