"use client"

import { Check, ChevronsUpDown } from "lucide-react"
import React, { useState } from 'react'
import { cn } from '../utils/shadcn_utils'
import { Button } from './button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from './command'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

interface RuleBuilderDropdownSelectProps {
  title: string
  items: string[]
  initialSelected: string
  onChangeSelected?: (item: string) => void
}

const RuleBuilderDropdownSelect: React.FC<RuleBuilderDropdownSelectProps> = ({ 
  title, 
  items, 
  initialSelected, 
  onChangeSelected 
}) => {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(initialSelected)
  const [searchValue, setSearchValue] = useState("")

  const handleSelect = (item: string) => {
    setSelected(item)
    setOpen(false)
    onChangeSelected?.(item)
  }

  const filteredItems = items.filter(item =>
    item.toLowerCase().includes(searchValue.toLowerCase())
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="flex justify-between font-display border border-black w-full select-none"
        >
          <span className="truncate">{selected || title}</span>
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
            {filteredItems.map((item, index) => (
              <CommandItem
                key={index}
                onSelect={() => handleSelect(item)}
                className={cn(
                  "flex items-center cursor-default focus-visible:ring-3 focus-visible:ring-yellow-300",
                )}
                tabIndex={0}
                onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSelect(item)
                  }
                }}
              >
                <span className="flex-1 truncate font-display text-sm">{item}</span>
                {item === selected && (
                  <Check className="h-4 w-4 ml-2" />
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default RuleBuilderDropdownSelect