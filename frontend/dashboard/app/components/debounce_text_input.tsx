"use client"

import React, { useState, useEffect, useCallback } from 'react'

interface DebounceTextInputProps {
  id: string
  placeholder: string
  initialValue: string
  onChange: (input: string) => void
}

const DebounceTextInput: React.FC<DebounceTextInputProps> = ({
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
      className="w-full font-body border border-black rounded-md p-2 text-sm transition-all outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] placeholder:text-neutral-400"
      value={inputValue}
      onChange={handleInputChange}
    />
  )
}


export default DebounceTextInput