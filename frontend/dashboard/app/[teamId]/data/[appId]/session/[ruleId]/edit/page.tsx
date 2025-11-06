"use client"

import { useRouter } from 'next/navigation'
import { Button } from '@/app/components/button'
import { Card, CardContent, CardFooter } from '@/app/components/card'

export default function EditSessionTimelineRule({ params }: { params: { teamId: string, appId: string, ruleId: string } }) {
    const router = useRouter()

    const handleCancel = () => {
        router.back()
    }

    const handleSave = () => {
        // TODO: Implement save logic
        router.back()
    }

    return (
        <div className="flex flex-col selection:bg-yellow-200/75 items-start">
            <p className="font-display text-4xl max-w-6xl text-center">Edit Session Filter</p>
            <div className="py-4" />

            <Card className="w-full">
                <CardContent className="pt-6">
                    <div className="mb-6">
                        {/* TODO: Add form fields */}
                    </div>
                </CardContent>

                <CardFooter className="flex justify-end gap-3">
                    <Button
                        variant="outline"
                        onClick={handleCancel}
                        className="font-display"
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleSave}
                        className="font-display border border-black"
                    >
                        Save Changes
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
