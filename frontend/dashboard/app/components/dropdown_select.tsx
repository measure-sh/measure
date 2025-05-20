"use client"

import React, { useEffect, useState } from 'react'
import { Check, ChevronsUpDown } from "lucide-react"
import { AppVersion, OsVersion } from '../api/api_calls'

import { Button } from './button'
import { cn } from '../utils/shadcn_utils'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import {
  Command,
  CommandInput,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from './command'

export enum DropdownSelectType {
  SingleString,
  MultiString,
  SingleAppVersion,
  MultiAppVersion,
  SingleOsVersion,
  MultiOsVersion
}

interface DropdownSelectProps {
  type: DropdownSelectType
  title: string
  items: string[] | AppVersion[] | OsVersion[]
  initialSelected: string | AppVersion | OsVersion | string[] | AppVersion[] | OsVersion[]
  onChangeSelected?: (item: string | AppVersion | OsVersion | string[] | AppVersion[] | OsVersion[]) => void
}

const DropdownSelect: React.FC<DropdownSelectProps> = ({ title, type, items, initialSelected, onChangeSelected }) => {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(initialSelected)
  const [searchValue, setSearchValue] = useState("")

  useEffect(() => {
    if (selected !== initialSelected) {
      setSelected(initialSelected)
    }
  }, [initialSelected])

  const selectSingleItem = (item: string | AppVersion | OsVersion) => {
    setSelected(item)
    setOpen(false)
  }

  const selectAll = () => {
    setSelected(items)
  }

  const clearAll = () => {
    setSelected([])
  }

  const selectLatestAppVersion = () => {
    // find version with highest build number
    let versions = items as AppVersion[]
    let latestVersion = versions.reduce((highest, current) =>
      parseInt(current.code) > parseInt(highest.code) ? current : highest
    )

    setSelected([latestVersion])
  }

  const toggleCheckboxStringItem = (item: string) => {
    let curSelected = selected as string[]
    if (curSelected.includes(item)) {
      setSelected(curSelected.filter(a => a != item))
    } else {
      setSelected([item, ...curSelected])
    }
  }

  const isOsVersionSelected = (item: OsVersion) => {
    return (selected as OsVersion[]).some((i) => {
      return item.displayName === i.displayName
    })
  }

  const toggleCheckboxOsVersionItem = (item: OsVersion) => {
    let curSelected = selected as OsVersion[]
    if (isOsVersionSelected(item)) {
      setSelected(curSelected.filter(a => a.displayName != item.displayName))
    } else {
      setSelected([item, ...curSelected])
    }
  }

  const isAppVersionSelected = (item: AppVersion) => {
    return (selected as AppVersion[]).some((i) => {
      return item.displayName === i.displayName
    })
  }

  const toggleCheckboxAppVersionItem = (item: AppVersion) => {
    let curSelected = selected as AppVersion[]
    if (isAppVersionSelected(item)) {
      // If only one item is selected, do nothing
      if (curSelected.length === 1) {
        return
      }
      setSelected(curSelected.filter(a => a.displayName != item.displayName))
    } else {
      setSelected([item, ...curSelected])
    }
  }

  useEffect(() => {
    onChangeSelected?.(selected)
  }, [selected, onChangeSelected])

  // Helper to get display text for selected items
  const getDisplayText = () => {
    switch (type) {
      case DropdownSelectType.SingleString:
        return selected as string
      case DropdownSelectType.SingleAppVersion:
        return (selected as AppVersion).displayName
      case DropdownSelectType.SingleOsVersion:
        return (selected as OsVersion).displayName
      case DropdownSelectType.MultiString:
      case DropdownSelectType.MultiAppVersion:
      case DropdownSelectType.MultiOsVersion:
        return title
    }
  }

  // Filter items based on search text
  const getFilteredItems = () => {
    const searchLower = searchValue.toLowerCase()
    switch (type) {
      case DropdownSelectType.SingleString:
      case DropdownSelectType.MultiString:
        return (items as string[]).filter(item =>
          item.toLowerCase().includes(searchLower)
        )
      case DropdownSelectType.SingleAppVersion:
      case DropdownSelectType.MultiAppVersion:
        return (items as AppVersion[]).filter(item =>
          item.displayName.toLowerCase().includes(searchLower)
        )
      case DropdownSelectType.SingleOsVersion:
      case DropdownSelectType.MultiOsVersion:
        return (items as OsVersion[]).filter(item =>
          item.displayName.toLowerCase().includes(searchLower)
        )
    }
  }

  const renderItemContent = (item: string | AppVersion | OsVersion) => {
    switch (type) {
      case DropdownSelectType.SingleString:
        return item as string
      case DropdownSelectType.MultiString:
        return item as string
      case DropdownSelectType.SingleAppVersion:
      case DropdownSelectType.MultiAppVersion:
        return (item as AppVersion).displayName
      case DropdownSelectType.SingleOsVersion:
      case DropdownSelectType.MultiOsVersion:
        return (item as OsVersion).displayName
    }
  }

  const isItemSelected = (item: string | AppVersion | OsVersion) => {
    switch (type) {
      case DropdownSelectType.SingleString:
        return item === selected
      case DropdownSelectType.MultiString:
        return (selected as string[]).includes(item as string)
      case DropdownSelectType.SingleAppVersion:
        return (item as AppVersion).displayName === (selected as AppVersion).displayName
      case DropdownSelectType.MultiAppVersion:
        return isAppVersionSelected(item as AppVersion)
      case DropdownSelectType.SingleOsVersion:
        return (item as OsVersion).displayName === (selected as OsVersion).displayName
      case DropdownSelectType.MultiOsVersion:
        return isOsVersionSelected(item as OsVersion)
    }
  }

  const handleItemClick = (item: string | AppVersion | OsVersion) => {
    switch (type) {
      case DropdownSelectType.SingleString:
      case DropdownSelectType.SingleAppVersion:
      case DropdownSelectType.SingleOsVersion:
        selectSingleItem(item)
        break
      case DropdownSelectType.MultiString:
        toggleCheckboxStringItem(item as string)
        break
      case DropdownSelectType.MultiAppVersion:
        toggleCheckboxAppVersionItem(item as AppVersion)
        break
      case DropdownSelectType.MultiOsVersion:
        toggleCheckboxOsVersionItem(item as OsVersion)
        break
    }
  }

  const isMultiSelect = () => {
    return type === DropdownSelectType.MultiString ||
      type === DropdownSelectType.MultiAppVersion ||
      type === DropdownSelectType.MultiOsVersion
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="flex justify-between font-display border border-black rounded-md"
          style={{ width: 'fit-content', minWidth: '150px' }}
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
          {isMultiSelect() && items.length > 1 && (
            <div className="flex gap-2 p-2 py-4">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
                className="font-display text-xs flex-1"
                tabIndex={0}
                onKeyDown={(e: React.KeyboardEvent<HTMLButtonElement>) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    selectAll()
                  }
                }}
              >
                All
              </Button>
              {type === DropdownSelectType.MultiAppVersion ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectLatestAppVersion}
                  className="font-display text-xs flex-1"
                  tabIndex={0}
                  onKeyDown={(e: React.KeyboardEvent<HTMLButtonElement>) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      selectLatestAppVersion()
                    }
                  }}
                >
                  Latest
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAll}
                  className="font-display text-xs flex-1"
                  tabIndex={0}
                  onKeyDown={(e: React.KeyboardEvent<HTMLButtonElement>) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      clearAll()
                    }
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          )}
          <CommandEmpty>
            <div className="text-center py-2 text-sm text-gray-500">No results found</div>
          </CommandEmpty>
          <CommandGroup className="max-h-72 overflow-auto">
            {getFilteredItems().map((item, index) => (
              <CommandItem
                key={index}
                onSelect={() => handleItemClick(item)}
                className={cn(
                  "flex items-center cursor-default focus:ring-3 focus:ring-yellow-300",
                )}
                tabIndex={0}
                onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleItemClick(item)
                  }
                }}
              >
                {isMultiSelect() && (
                  <span className="mr-2 flex items-center justify-center w-4 h-4">
                    {isItemSelected(item) ? <Check className="h-4 w-4" /> : null}
                  </span>
                )}
                <span className="flex-1 truncate font-display text-sm">{renderItemContent(item)}</span>
                {!isMultiSelect() && isItemSelected(item) && (
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

export default DropdownSelect