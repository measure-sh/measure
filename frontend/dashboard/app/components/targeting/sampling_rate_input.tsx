import { useState } from 'react'

interface SamplingRateInputProps {
    value: number
    onChange: (value: number) => void
    disabled?: boolean
    type?: 'events' | 'traces'
}

export default function SamplingRateInput({ value, onChange, disabled = false, type = 'events' }: SamplingRateInputProps) {
    const [localValue, setLocalValue] = useState<string>(value.toString())

    const handleBlur = () => {
        const numValue = parseFloat(localValue)
        if (isNaN(numValue) || localValue.trim() === '') {
            // Reset to parent value if invalid
            setLocalValue(value.toString())
        } else {
            // Clamp and update parent
            const clampedValue = Math.max(0, Math.min(100, numValue))
            onChange(clampedValue)
            setLocalValue(clampedValue.toString())
        }
    }

    const handleFocus = () => {
        // Sync with parent value when focusing
        setLocalValue(value.toString())
    }

    return (
        <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-body whitespace-nowrap">Collect all {type} at</span>
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={localValue}
                    onChange={(e) => setLocalValue(e.target.value)}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    disabled={disabled}
                    className="w-32 border border-black rounded-md outline-hidden text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] py-2 px-4 font-body disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="text-sm font-body whitespace-nowrap">% sampling rate</span>
            </div>
        </div>
    )
}
