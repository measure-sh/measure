"use client"

import React, { useCallback, useEffect, useState } from 'react'
import { cn } from '../utils/shadcn_utils'
import { Input } from './input'

interface DebounceTextInputProps {
  className?: string
  id: string
  placeholder: string
  initialValue: string
  onChange: (input: string) => void
}

const DebounceTextInput: React.FC<DebounceTextInputProps> = ({
  className,
  id,
  placeholder,
  initialValue,
  onChange
}) => {
  const [inputValue, setInputValue] = useState(initialValue)

  useEffect(() => {
    if (inputValue !== initialValue) {
      setInputValue(initialValue)
    }
  }, [initialValue])

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(inputValue)
    }, 500)

    return () => {
      clearTimeout(timer)
    }
  }, [inputValue, onChange])

  return (
    <Input
      id={id}
      type="text"
      placeholder={placeholder}
      className={cn("w-full font-body", className)}
      value={inputValue}
      onChange={handleInputChange}
    />
  )
}


export default DebounceTextInput