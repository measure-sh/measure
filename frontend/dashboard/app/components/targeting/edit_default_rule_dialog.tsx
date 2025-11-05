"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/dialog'
import { Button } from '@/app/components/button'
import SamplingRateInput from '@/app/components/targeting/sampling_rate_input'
import { useState, useEffect } from 'react'

type CollectionMode = 'sample_rate' | 'timeline_only' | 'disable'

interface EditDefaultRuleDialogProps {
    isOpen: boolean
    ruleType: 'event' | 'trace'
    ruleId: string
    appId: string
    initialCollectionMode: CollectionMode
    initialSampleRate?: number
    onClose: () => void
    onSuccess: () => void
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
            // TODO: Implement actual API call
            // const result = await updateDefaultTargetingRule(appId, ruleId, {
            //     collection_config: collectionMode === 'sample_rate'
            //         ? { mode: 'sample_rate', sample_rate: sampleRate }
            //         : { mode: collectionMode }
            // })

            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 500))

            // For now, always succeed
            onSuccess()
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
            <DialogContent className="font-display">
                <DialogHeader>
                    <DialogTitle className="font-display text-2xl">
                        Edit Default {displayName} Rule
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Collection Config Section */}
                    <div className="space-y-3">
                        <p className="font-display text-sm font-medium">Collection Config</p>

                        <label className="flex items-center gap-3 cursor-pointer h-10">
                            <input
                                type="radio"
                                name="collectionMode"
                                value="sample_rate"
                                checked={collectionMode === 'sample_rate'}
                                onChange={() => setCollectionMode('sample_rate')}
                                disabled={isSaving}
                                className="appearance-none w-4 h-4 border border-gray-400 rounded-full checked:bg-black checked:border-black cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <SamplingRateInput
                                value={sampleRate}
                                onChange={setSampleRate}
                                disabled={collectionMode !== 'sample_rate' || isSaving}
                            />
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer h-10">
                            <input
                                type="radio"
                                name="collectionMode"
                                value="timeline_only"
                                checked={collectionMode === 'timeline_only'}
                                onChange={() => setCollectionMode('timeline_only')}
                                disabled={isSaving}
                                className="appearance-none w-4 h-4 border border-gray-400 rounded-full checked:bg-black checked:border-black cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <span className="text-sm font-body">Collect with session timeline only</span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer h-10">
                            <input
                                type="radio"
                                name="collectionMode"
                                value="disable"
                                checked={collectionMode === 'disable'}
                                onChange={() => setCollectionMode('disable')}
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
