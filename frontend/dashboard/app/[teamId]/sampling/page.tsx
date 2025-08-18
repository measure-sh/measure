"use client"

import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/app/components/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/table'

export default function Sampling({ params }: { params: { teamId: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start">
      <div className="flex flex-row items-center gap-2 justify-between w-full">
        <p className="font-display text-4xl max-w-6xl text-center">Sampling</p>
        <Button
          onClick={() => router.push(`/${params.teamId}/sampling/create_rule`)}
          className="font-display border border-black"
        >
          Create Rule
        </Button>
      </div>
      <div className="py-4" />

      <div className="w-full">
        <Table className="font-display">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50%]">Rule</TableHead>
              <TableHead className="w-[20%]">Created</TableHead>
              <TableHead className="w-[20%]">Last Modified</TableHead>
              <TableHead className="w-[10%] text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="font-body hover:bg-yellow-200 focus-visible:border-yellow-200 select-none">
              <TableCell className="w-[50%] relative p-0">
                <div className="pointer-events-none p-4">
                  <p className="truncate select-none">Critical issues</p>
                  <div className="py-1" />
                  <p className="text-xs truncate text-gray-500 select-none">
                    event_type == "exception" || event_type == "anr" || event_type == "bug_report"
                  </p>
                  <div className="py-1" />
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md">Session Sampling</span>
                </div>
              </TableCell>
              <TableCell className="w-[20%] relative p-0">
                <div className="pointer-events-none p-4">
                  <p className="truncate select-none">2024-01-15T14:30:22Z</p>
                  <div className="py-1" />
                  <p className="text-xs truncate text-gray-500 select-none">
                    soodabhay23@gmail.com
                  </p>
                </div>
              </TableCell>
              <TableCell className="w-[20%] relative p-0">
                <div className="pointer-events-none p-4">
                  <p className="truncate select-none">2024-01-20T09:15:45Z</p>
                  <div className="py-1" />
                  <p className="text-xs truncate text-gray-500 select-none">
                    debjeet@measure.sh
                  </p>
                </div>
              </TableCell>
              <TableCell className="w-[10%] relative p-0">
                <div className="pointer-events-none p-4 items-center flex justify-center">
                  <p className="w-20 px-2 py-1 rounded-full border text-sm font-body select-none border-green-600 text-green-600 bg-green-50">
                    Enabled
                  </p>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  )
}