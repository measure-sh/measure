"use client"

import { cn } from "@/app/utils/shadcn_utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-accent/25 dark:bg-accent animate-pulse rounded-md", className)}
      {...props}
    />
  )
}

function SkeletonPlot({ className, showAxes = true, ...props }: React.ComponentProps<"div"> & { showAxes?: boolean }) {
  return (
    <div className={cn("flex flex-col w-full h-full p-4 gap-3", className)} {...props}>
      <div className="flex flex-row flex-1 gap-3">
        {showAxes &&
          <div className="flex flex-col flex-shrink-0 justify-between py-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-8" />
            ))}
          </div>
        }
        <Skeleton className="flex-1 rounded-lg" />
      </div>
      {showAxes &&
        <div className="flex flex-row justify-between pl-16 pr-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-3" />
          ))}
        </div>
      }
    </div>
  )
}

function SkeletonTable({ rows = 5, columns = 3 }: { rows?: number, columns?: number }) {
  const widths = ['w-1/2', 'w-1/3', 'w-2/3', 'w-1/4', 'w-3/4']
  return (
    <div className="flex flex-col w-full gap-4 py-4">
      <div className="flex flex-row gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className={cn("h-4", i === 0 ? "flex-[2]" : "flex-1")} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex flex-row gap-4">
          {Array.from({ length: columns }).map((_, colIdx) => (
            <Skeleton key={colIdx} className={cn("h-4", colIdx === 0 ? "flex-[2]" : "flex-1", widths[(rowIdx + colIdx) % widths.length])} />
          ))}
        </div>
      ))}
    </div>
  )
}

function SkeletonMetricsCard() {
  return (
    <>
      <Skeleton className="h-8 w-24" />
      <div className="py-1" />
      <Skeleton className="h-4 w-16" />
    </>
  )
}

function SkeletonListPage({ tableColumns = 3, showPlot = true }: { tableColumns?: number, showPlot?: boolean }) {
  return (
    <div className="flex flex-col items-center w-full">
      {showPlot &&
        <div className="flex font-body items-center justify-center w-full h-[36rem]">
          <SkeletonPlot />
        </div>
      }
      <SkeletonTable rows={5} columns={tableColumns} />
    </div>
  )
}

export { Skeleton, SkeletonListPage, SkeletonMetricsCard, SkeletonPlot, SkeletonTable }

