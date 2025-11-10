"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/dialog'
import { Button } from '@/app/components/button'
import SamplingRateInput from '@/app/components/targeting/sampling_rate_input'
import { useState, useEffect } from 'react'
import { DialogDescription } from '@radix-ui/react-dialog'
import { updateEventTargetingRule, updateTraceTargetingRule, UpdateEventTargetingRuleApiStatus, UpdateTraceTargetingRuleApiStatus } from '@/app/api/api_calls'

type CollectionMode = 'sampled' | 'session_timeline' | 'disabled'

interface EditDefaultRuleDialogProps {
    isOpen: boolean
    ruleType: 'event' | 'trace'
    ruleId: string
    appId: string
    condition: string
    takeScreenshot?: boolean
    takeLayoutSnapshot?: boolean
    initialCollectionMode: CollectionMode
    initialSampleRate?: number
    onClose: () => void
    onSuccess: (collectionMode: CollectionMode, sampleRate?: number) => void
    onError: (error: string) => void
}

export default function EditDefaultRuleDialog({
    isOpen,
    onClose,
    onSuccess,
    onError,
    ruleType,
    ruleId,
    appId,
    condition,
    takeScreenshot,
    takeLayoutSnapshot,
    initialCollectionMode,
    initialSampleRate
}: EditDefaultRuleDialogProps) {
    const [collectionMode, setCollectionMode] = useState<CollectionMode>(initialCollectionMode)
    const [sampleRate, setSampleRate] = useState<number>(initialSampleRate || 100)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setCollectionMode(initialCollectionMode)
            setSampleRate(initialSampleRate || 100)
        }
    }, [isOpen, initialCollectionMode, initialSampleRate])

    const handleSave = async () => {
        setIsSaving(true)

        try {
            if (ruleType === 'event') {
                const result = await updateEventTargetingRule(appId, ruleId, {
                    condition,
                    collection_mode: collectionMode,
                    sampling_rate: collectionMode === 'sampled' ? sampleRate : 0,
                    take_screenshot: takeScreenshot || false,
                    take_layout_snapshot: takeLayoutSnapshot || false
                })

                if (result.status === UpdateEventTargetingRuleApiStatus.Error) {
                    onError(result.error || 'Failed to update rule')
                    return
                }
            } else {
                const result = await updateTraceTargetingRule(appId, ruleId, {
                    condition,
                    collection_mode: collectionMode,
                    sampling_rate: collectionMode === 'sampled' ? sampleRate : 0
                })

                if (result.status === UpdateTraceTargetingRuleApiStatus.Error) {
                    onError(result.error || 'Failed to update rule')
                    return
                }
            }

            onSuccess(collectionMode, collectionMode === 'sampled' ? sampleRate : undefined)
            onClose()
        } catch (error) {
            onError(error instanceof Error ? error.message : 'Failed to update rule')
        } finally {
            setIsSaving(false)
        }
    }

    const isEvent = ruleType === 'event'
    const displayName = isEvent ? 'Events' : 'Traces'
    const displayNameLower = isEvent ? 'events' : 'traces'

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="font-display max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="font-display text-2xl">
                        Modify Default {displayName} Behaviour
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        Configure collection settings for default {displayNameLower} rule
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer h-10">
                            <input
                                type="radio"
                                name="collectionMode"
                                value="sampled"
                                checked={collectionMode === 'sampled'}
                                onChange={() => setCollectionMode('sampled')}
                                disabled={isSaving}
                                className="appearance-none w-4 h-4 border border-gray-400 rounded-full checked:bg-black checked:border-black cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <SamplingRateInput
                                value={sampleRate}
                                onChange={setSampleRate}
                                disabled={collectionMode !== 'sampled' || isSaving}
                                type={displayNameLower as 'events' | 'traces'}
                            />
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer h-10">
                            <input
                                type="radio"
                                name="collectionMode"
                                value="timeline"
                                checked={collectionMode === 'session_timeline'}
                                onChange={() => setCollectionMode('session_timeline')}
                                disabled={isSaving}
                                className="appearance-none w-4 h-4 border border-gray-400 rounded-full checked:bg-black checked:border-black cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <span className="text-sm font-body">Collect {displayNameLower} with session timeline only</span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer h-10">
                            <input
                                type="radio"
                                name="collectionMode"
                                value="disable"
                                checked={collectionMode === 'disabled'}
                                onChange={() => setCollectionMode('disabled')}
                                disabled={isSaving}
                                className="appearance-none w-4 h-4 border border-gray-400 rounded-full checked:bg-black checked:border-black cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <span className="text-sm font-body">Collect no {displayNameLower} by default</span>
                        </label>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isSaving}
                        className="font-display"
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleSave}
                        disabled={isSaving}
                        loading={isSaving}
                        className="font-display border border-black"
                    >
                        Confirm
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
