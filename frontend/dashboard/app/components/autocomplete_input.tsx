"use client"

import { useEffect, useRef, useState } from "react"
import { Popover, PopoverContent, PopoverAnchor } from "./popover"
import { cn } from "@/app/utils/shadcn_utils"

interface AutocompleteInputProps {
    value: string
    suggestions?: string[]
    placeholder?: string
    onValueChange: (value: string) => void
    className?: string
}

export default function AutocompleteInput({
    value,
    suggestions = [],
    placeholder = "Enter value...",
    onValueChange,
    className = "w-112"
}: AutocompleteInputProps) {
    const [suggestionsOpen, setSuggestionsOpen] = useState(false)
    const [searchValue, setSearchValue] = useState("")
    const [highlightedIndex, setHighlightedIndex] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)
    const listRef = useRef<HTMLDivElement>(null)
    const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())

    useEffect(() => {
        setSearchValue(value)
    }, [value])

    const filteredSuggestions = searchValue
        ? suggestions.filter(suggestion =>
            suggestion.toLowerCase().includes(searchValue.toLowerCase())
        )
        : suggestions

    // Reset highlighted index when filtered list changes
    useEffect(() => {
        setHighlightedIndex(0)
    }, [filteredSuggestions.length])

    // Use suggestion value as key for stable refs
    const setItemRef = (suggestion: string, idx: number, el: HTMLDivElement | null) => {
        const key = `${idx}-${suggestion}`
        if (el) {
            itemRefs.current.set(key, el)
        } else {
            itemRefs.current.delete(key)
        }
    }

    const getItemRef = (idx: number) => {
        if (idx >= 0 && idx < filteredSuggestions.length) {
            const suggestion = filteredSuggestions[idx]
            const key = `${idx}-${suggestion}`
            return itemRefs.current.get(key)
        }
        return undefined
    }

    const handleSuggestionClick = (suggestion: string) => {
        onValueChange(suggestion)
        setSearchValue(suggestion)
        setSuggestionsOpen(false)
        inputRef.current?.focus()
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value
        setSearchValue(newValue)
        onValueChange(newValue)
        setSuggestionsOpen(true)
    }

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!suggestionsOpen || filteredSuggestions.length === 0) return

        switch (e.key) {
            case 'Tab':
                if (filteredSuggestions.length > 0) {
                    e.preventDefault()
                    getItemRef(0)?.focus()
                }
                break
            case 'Enter':
                e.preventDefault()
                if (filteredSuggestions[highlightedIndex]) {
                    handleSuggestionClick(filteredSuggestions[highlightedIndex])
                }
                break
            case 'Escape':
                e.preventDefault()
                setSuggestionsOpen(false)
                inputRef.current?.focus()
                break
        }
    }

    const handleItemKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, idx: number) => {
        switch (e.key) {
            case 'Enter':
            case ' ':
                e.preventDefault()
                handleSuggestionClick(filteredSuggestions[idx])
                break
            case 'Escape':
                e.preventDefault()
                setSuggestionsOpen(false)
                inputRef.current?.focus()
                break
        }
    }

    const handleItemBlur = () => {
        setTimeout(() => {
            const activeElement = document.activeElement
            const isInputFocused = activeElement === inputRef.current
            const isItemFocused = Array.from(itemRefs.current.values()).some(ref => ref === activeElement)

            if (!isInputFocused && !isItemFocused) {
                setSuggestionsOpen(false)
            }
        }, 0)
    }

    return (
        <Popover open={suggestionsOpen} onOpenChange={setSuggestionsOpen}>
            <PopoverAnchor asChild>
                <input
                    ref={inputRef}
                    type="text"
                    role="combobox"
                    aria-expanded={suggestionsOpen}
                    aria-autocomplete="list"
                    aria-controls="suggestions-list"
                    value={searchValue}
                    onChange={handleInputChange}
                    onKeyDown={handleInputKeyDown}
                    onFocus={() => setSuggestionsOpen(true)}
                    onBlur={() => setTimeout(() => {
                        const activeElement = document.activeElement
                        const isItemFocused = Array.from(itemRefs.current.values()).some(ref => ref === activeElement)
                        if (!isItemFocused) {
                            setSuggestionsOpen(false)
                        }
                    }, 0)}
                    placeholder={placeholder}
                    className={cn(
                        "border rounded-md outline-hidden text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] py-2 px-4 font-body placeholder:text-neutral-400 border-black",
                        className
                    )}
                />
            </PopoverAnchor>
            {suggestionsOpen && filteredSuggestions.length > 0 && (
                <PopoverContent
                    className={cn("p-1", className)}
                    align="start"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                >
                    <div
                        ref={listRef}
                        id="suggestions-list"
                        role="listbox"
                        className="max-h-72 overflow-auto"
                    >
                        {filteredSuggestions.map((suggestion, idx) => (
                            <div
                                key={`${idx}-${suggestion}`}
                                ref={el => setItemRef(suggestion, idx, el)}
                                role="option"
                                tabIndex={0}
                                aria-selected={idx === highlightedIndex}
                                className={cn(
                                    "flex items-center px-2 py-1.5 cursor-default rounded-sm font-display text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300",
                                    idx === highlightedIndex && "bg-accent text-accent-foreground"
                                )}
                                onFocus={() => setHighlightedIndex(idx)}
                                onMouseEnter={() => setHighlightedIndex(idx)}
                                onMouseDown={(e) => {
                                    e.preventDefault()
                                    handleSuggestionClick(suggestion)
                                }}
                                onKeyDown={(e) => handleItemKeyDown(e, idx)}
                                onBlur={handleItemBlur}
                            >
                                <span className="flex-1 truncate">{suggestion}</span>
                            </div>
                        ))}
                    </div>
                </PopoverContent>
            )}
        </Popover>
    )
}