import { useState, useEffect } from 'react'

interface SamplingRateInputProps {
    value: number
    onChange: (value: number) => void
    disabled?: boolean
}

const formatSamplingRate = (value: string): string => {
    if (value === '') return ''
    const numValue = parseFloat(value)
    if (isNaN(numValue)) return ''
    const clampedValue = Math.max(0, Math.min(100, numValue))
    const formattedValue = Math.round(clampedValue * 1000000) / 1000000
    return formattedValue.toString()
}

export default function SamplingRateInput({ value, onChange, disabled = false }: SamplingRateInputProps) {
    const [inputValue, setInputValue] = useState(value.toString())

    // Sync with prop value when it changes externally
    useEffect(() => {
        setInputValue(value.toString())
    }, [value])

    const handleBlur = () => {
        const formatted = formatSamplingRate(inputValue)

        if (formatted !== '') {
            const numValue = parseFloat(formatted)
            onChange(numValue)
            setInputValue(numValue.toString())
        } else {
            // Reset to current value if invalid
            setInputValue(value.toString())
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value)
    }

    return (
        <div className="flex items-center gap-3">
            <span className="text-sm font-body">Collect at</span>
            <input
                type="number"
                min="0"
                max="100"
                step="0.000001"
                value={inputValue}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={disabled}
                className="w-32 border border-black rounded-md outline-hidden text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] py-2 px-4 font-body disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className="text-sm font-body">% sampling rate</span>
        </div>
    )
}
