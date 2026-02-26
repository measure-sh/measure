import { useEffect, useState } from 'react'
import { Input } from './input'

interface SdkConfigNumericInputProps {
    value: number
    minValue?: number
    maxValue: number
    step?: number
    type?: 'integer' | 'float'
    precision?: number
    onChange: (value: number) => void
    disabled?: boolean
    testId?: string
    fixedWidth?: number
}

export default function SdkConfigNumericInput({
    value,
    minValue = 0,
    maxValue,
    step = 1,
    type = 'integer',
    precision = 3,
    onChange,
    disabled = false,
    testId,
    fixedWidth
}: SdkConfigNumericInputProps) {
    const [localValue, setLocalValue] = useState<string>(value.toString())

    useEffect(() => {
        setLocalValue(value.toString())
    }, [value])

    const parseValue = (str: string): number => {
        return type === 'integer' ? parseInt(str, 10) : parseFloat(str)
    }

    const formatValue = (num: number): number => {
        if (type === 'float') {
            const factor = Math.pow(10, precision)
            return Math.round(num * factor) / factor
        }
        return num
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value
        setLocalValue(newValue)

        const numValue = parseValue(newValue)
        if (!isNaN(numValue) && newValue.trim() !== '') {
            const clampedValue = formatValue(Math.max(minValue, Math.min(maxValue, numValue)))
            onChange(clampedValue)
        }
    }

    const handleBlur = () => {
        const numValue = parseValue(localValue)
        if (isNaN(numValue) || localValue.trim() === '') {
            setLocalValue(value.toString())
        } else {
            const clampedValue = formatValue(Math.max(minValue, Math.min(maxValue, numValue)))
            setLocalValue(clampedValue.toString())
        }
    }

    // Minimum width based on max/min value length, with a floor of 8ch
    const minChars = Math.max(
        maxValue.toString().length,
        minValue.toString().length,
        4
    )
    const inputWidth = fixedWidth ?? Math.max(minChars, localValue.length) + 6

    return (
        <Input
            data-testid={testId}
            type="number"
            min={minValue}
            max={maxValue}
            step={step}
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={disabled}
            style={{ width: `${inputWidth}ch` }}
            className="transition-[width]"
        />
    )
}