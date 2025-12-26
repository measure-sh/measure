import { useState, useEffect } from 'react'

interface SamplingRateInputProps {
    value: number
    maxValue: number
    onChange: (value: number) => void
    disabled?: boolean
    testId?: string 
}

export default function SamplingRateInput({ value, maxValue, onChange, disabled = false, testId}: SamplingRateInputProps) {
    const [localValue, setLocalValue] = useState<string>(value.toString())

    useEffect(() => {
        setLocalValue(value.toString())
    }, [value])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value
        setLocalValue(newValue)
        
        const numValue = parseFloat(newValue)
        if (!isNaN(numValue) && newValue.trim() !== '') {
            const clampedValue = Math.max(0, Math.min(maxValue, numValue))
            onChange(clampedValue)
        }
    }

    const handleBlur = () => {
        const numValue = parseFloat(localValue)
        if (isNaN(numValue) || localValue.trim() === '') {
            setLocalValue(value.toString())
        } else {
            const clampedValue = Math.max(0, Math.min(maxValue, numValue))
            setLocalValue(clampedValue.toString())
        }
    }

    return (
        <input
            data-testid={testId}
            type="number"
            min="0"
            max={maxValue}
            step="0.01"
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={disabled}
            placeholder={`0-${maxValue}%`}
            className="w-32 border border-black rounded-md outline-hidden text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] py-2 px-4 font-body placeholder:text-neutral-400 disabled:opacity-50 disabled:cursor-not-allowed"
        />
    )
}