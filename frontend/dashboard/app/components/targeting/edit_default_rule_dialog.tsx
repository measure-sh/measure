"use client"

import { EventTargetingCollectionConfig, EventTargetingRuleType } from '@/app/api/api_calls'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/dialog'
import { Button } from '@/app/components/button'
import SamplingRateInput from '@/app/components/targeting/sampling_rate_input'

export interface DefaultRuleState {
    id: string
    type: EventTargetingRuleType
    collectionMode: EventTargetingCollectionConfig['mode']
    sampleRate?: number
}

interface EditDefaultRuleDialogProps {
    isOpen: boolean
    defaultRule: DefaultRuleState | null
    onClose: () => void
    onSave: () => void
    onUpdate: (updatedRule: DefaultRuleState) => void
}

export default function EditDefaultRuleDialog({
    isOpen,
    defaultRule,
    onClose,
    onSave,
    onUpdate
}: EditDefaultRuleDialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="font-display">
                <DialogHeader>
                    <DialogTitle className="font-display text-2xl">
                        Edit Default {defaultRule?.type === 'all_events' ? 'Events' : 'Traces'} Rule
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-3 py-4">
                    <label className="flex items-center gap-3 cursor-pointer h-10">
                        <input
                            type="radio"
                            name="collectionMode"
                            value="sample_rate"
                            checked={defaultRule?.collectionMode === 'sample_rate'}
                            onChange={(e) => defaultRule && onUpdate({
                                ...defaultRule,
                                collectionMode: 'sample_rate',
                                sampleRate: defaultRule.sampleRate || 100
                            })}
                            className="appearance-none w-4 h-4 border border-gray-400 rounded-full checked:bg-black checked:border-black cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 flex-shrink-0"
                        />
                        <SamplingRateInput
                            value={defaultRule?.sampleRate || 100}
                            onChange={(value) => defaultRule && onUpdate({
                                ...defaultRule,
                                collectionMode: 'sample_rate',
                                sampleRate: value
                            })}
                            disabled={defaultRule?.collectionMode !== 'sample_rate'}
                        />
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer h-10">
                        <input
                            type="radio"
                            name="collectionMode"
                            value="timeline_only"
                            checked={defaultRule?.collectionMode === 'timeline_only'}
                            onChange={(e) => defaultRule && onUpdate({
                                ...defaultRule,
                                collectionMode: 'timeline_only'
                            })}
                            className="appearance-none w-4 h-4 border border-gray-400 rounded-full checked:bg-black checked:border-black cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 flex-shrink-0"
                        />
                        <span className="text-sm font-body">Collect with session timeline only</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer h-10">
                        <input
                            type="radio"
                            name="collectionMode"
                            value="disable"
                            checked={defaultRule?.collectionMode === 'disable'}
                            onChange={(e) => defaultRule && onUpdate({
                                ...defaultRule,
                                collectionMode: 'disable'
                            })}
                            className="appearance-none w-4 h-4 border border-gray-400 rounded-full checked:bg-black checked:border-black cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 flex-shrink-0"
                        />
                        <span className="text-sm font-body">Collect no {defaultRule?.type === 'all_events' ? 'events' : 'traces'} by default</span>
                    </label>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="font-display"
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="outline"
                        onClick={onSave}
                        className="font-display border border-black"
                    >
                        Confirm
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
