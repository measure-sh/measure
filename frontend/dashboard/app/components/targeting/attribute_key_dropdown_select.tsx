"use client"

import { Check, ChevronsUpDown } from "lucide-react"
import React, { useEffect, useState } from 'react'

import { cn } from '../../utils/shadcn_utils'
import { Button } from '../button'
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
} from '../command'
import { Popover, PopoverContent, PopoverTrigger } from '../popover'

interface AttributeKeyDropdownSelectProps {
    title: string
    items: Record<string, string>
    initialSelected: string
    onKeySelected?: (key: string, type: string) => void
    buttonClassName?: string
}

const AttributeKeyDropdownSelect: React.FC<AttributeKeyDropdownSelectProps> = ({
    title,
    items,
    initialSelected,
    onKeySelected,
    buttonClassName
}) => {
    const [open, setOpen] = useState(false)
    const [selected, setSelected] = useState(initialSelected)
    const [searchValue, setSearchValue] = useState("")

    useEffect(() => {
        if (selected !== initialSelected) {
            setSelected(initialSelected)
        }
    }, [initialSelected])

    const handleItemClick = (key: string) => {
        setSelected(key)
        setOpen(false)
        onKeySelected?.(key, items[key])
    }

    const getFilteredItems = () => {
        const searchLower = searchValue.toLowerCase()
        return Object.entries(items).filter(([key]) =>
            key.toLowerCase().includes(searchLower)
        )
    }

    const getDisplayText = () => {
        return selected ? selected : title
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={buttonClassName || "flex justify-between font-display border border-black w-fit min-w-[150px] select-none"}
                >
                    <span className="truncate">{getDisplayText()}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-64" align="start">
                <Command>
                    <CommandInput
                        placeholder="Search..."
                        value={searchValue}
                        onValueChange={setSearchValue}
                        className="h-10 p-1 border border-0 rounded-md focus:ring-0 font-body text-sm"
                    />
                    <CommandEmpty>
                        <div className="text-center py-2 text-sm text-gray-500">No results found</div>
                    </CommandEmpty>
                    <CommandGroup className="max-h-72 overflow-auto">
                        {getFilteredItems().map(([key, type]) => (
                            <CommandItem
                                key={key}
                                onSelect={() => handleItemClick(key)}
                                className={cn(
                                    "flex items-center justify-between cursor-default focus-visible:ring-3 focus-visible:ring-yellow-300",
                                )}
                                tabIndex={0}
                                onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault()
                                        handleItemClick(key)
                                    }
                                }}
                            >
                                <span className="flex-1 truncate font-display text-sm">{key}</span>
                                <div className="flex items-center gap-2">
                                    {selected === key && (
                                        <Check className="h-4 w-4 ml-1 shrink-0" />
                                    )}
                                </div>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

export default AttributeKeyDropdownSelect