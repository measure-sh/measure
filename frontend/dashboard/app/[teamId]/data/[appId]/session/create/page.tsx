"use client"

import { useRouter } from 'next/navigation'
import { Button } from '@/app/components/button'

export default function CreateSessionTimelineRule({ params }: { params: { teamId: string, appId: string } }) {
    const router = useRouter()

    const handleCancel = () => {
        router.back()
    }

    const handleCreate = () => {
        // TODO: Implement create logic
        router.back()
    }

    return (
        <div className="flex flex-col selection:bg-yellow-200/75 items-start">
            <p className="font-display text-4xl max-w-6xl text-center">Create Session Timeline Rule</p>
            <div className="py-4" />

            <div className="w-full flex flex-col">
                {/* Reserved space for content */}
                <div className="mb-6">
                    {/* TODO: Add form fields */}
                </div>

                {/* Action buttons */}
                <div className="flex justify-end gap-3">
                    <Button
                        variant="outline"
                        onClick={handleCancel}
                        className="font-display"
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleCreate}
                        className="font-display border border-black"
                    >
                        Create Filter
                    </Button>
                </div>
            </div>
        </div>
    )
}
