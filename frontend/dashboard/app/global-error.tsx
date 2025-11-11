"use client"

import Link from 'next/link'
import posthog from 'posthog-js'
import { useEffect } from 'react'
import { Button } from './components/button'
import { underlineLinkStyle } from './utils/shared_styles'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    posthog.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <div className="flex flex-col selection:bg-yellow-200/75 items-center justify-center font-body p-24 w-full h-screen">
          <p className="font-display font-regular text-4xl">Something went wrong!</p>
          <div className="py-2" />
          <Link target='_blank' className={underlineLinkStyle} href='https://github.com/measure-sh/measure/issues/new?assignees=&labels=bug&projects=&template=bug_report.md&title='>Report issue</Link>
          <div className="py-8" />
          <div className="w-fit">
            <p className="">Error message: </p>
            <div className="py-1" />
            <p className="w-fit bg-red-200 border border-black selection:bg-yellow-200/50 grid text-left text-sm font-body whitespace-pre-wrap rounded-md p-4">{error.message}</p>
            <div className="py-2" />
            <Button
              variant="outline"
              className="font-display border border-black select-none"
              onClick={() => navigator.clipboard.writeText(error.message)}
            >Copy
            </Button>
          </div>
        </div>
      </body>
    </html>
  )
}