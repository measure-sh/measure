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
      className="w-full border border-black rounded-md outline-hidden focus-visible:outline-yellow-300 py-2 px-4 font-body placeholder:text-neutral-400"
      value={inputValue}
      onChange={handleInputChange}
    />
  )
}

export default DebounceTextInput