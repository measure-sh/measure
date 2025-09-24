"use client"

import React, { useCallback, useEffect, useState } from 'react'
import { cn } from '../utils/shadcn_utils'

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
    <input
      id={id}
      type="text"
      placeholder={placeholder}
      className={cn("w-full font-body border border-black rounded-md p-2 text-sm transition-all outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] placeholder:text-neutral-400", className)}
      value={inputValue}
      onChange={handleInputChange}
    />
  )
}


export default DebounceTextInput