"use client"

import { ChevronsUpDown, Circle, CircleCheck } from "lucide-react"
import React, { useEffect, useState } from 'react'
import { UserDefAttr } from '../api/api_calls'
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

export type UdAttrMatcher = {
  key: string
  type: string
  op: string
  value: string | number | boolean
}

interface UserDefAttrSelectorProps {
  attrs: UserDefAttr[]
  ops: Map<string, string[]>
  initialSelected: UdAttrMatcher[]
  onChangeSelected?: (udattrMatchers: UdAttrMatcher[]) => void
}

const UserDefAttrSelector: React.FC<UserDefAttrSelectorProps> = ({ attrs, ops, initialSelected, onChangeSelected }) => {
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")
  const [selectedAttrs, setSelectedAttrs] = useState<UserDefAttr[]>(
    initialSelected.map((attr) => ({ key: attr.key, type: attr.type }))
  )

  const getDefaultValue = (type: string) => {
    switch (type) {
      case "bool": return false
      case "string": return ""
      default: return 0
    }
  }

  const [selectedKeyOpMap, setSelectedKeyOpMap] = useState<Map<string, string>>(() => {
    const map = new Map()
    attrs.forEach((attr) => map.set(attr.key, ops.get(attr.type)![0]))
    initialSelected.forEach((attr) => map.set(attr.key, attr.op))
    return map
  })
  const [selectedKeyValMap, setSelectedKeyValMap] = useState<Map<string, string | number | boolean>>(() => {
    const map = new Map()
    attrs.forEach((attr) => map.set(attr.key, getDefaultValue(attr.type)))
    initialSelected.forEach((attr) => map.set(attr.key, attr.value))
    return map
  })



  const isAttrSelected = (item: UserDefAttr) => {
    return selectedAttrs.some(i => i.key === item.key)
  }

  const toggleAttr = (attr: UserDefAttr) => {
    setSelectedAttrs(prev => isAttrSelected(attr)
      ? prev.filter(a => a.key !== attr.key)
      : [...prev, attr]
    )
  }

  const clearAll = () => setSelectedAttrs([])

  const updateSelectedOp = (key: string, op: string) => {
    setSelectedKeyOpMap(prev => new Map(prev).set(key, op))
  }

  const updateSelectedValue = (key: string, val: string | number | boolean) => {
    setSelectedKeyValMap(prev => new Map(prev).set(key, val))
  }

  const getUdAttrMatchers = (): UdAttrMatcher[] => {
    return selectedAttrs.map(attr => ({
      key: attr.key,
      type: attr.type,
      op: selectedKeyOpMap.get(attr.key)!,
      value: selectedKeyValMap.get(attr.key)!
    }))
  }

  useEffect(() => {
    onChangeSelected?.(getUdAttrMatchers())
  }, [selectedAttrs, selectedKeyOpMap, selectedKeyValMap])

  const renderValueInput = (attr: UserDefAttr) => {
    const value = selectedKeyValMap.get(attr.key)
    const valueClass = "sm:ml-2 ml-0 p-1 text-sm bg-background border border-border rounded-md w-full transition-all disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"

    switch (attr.type) {
      case 'bool':
        return (
          <select
            value={String(value)}
            onChange={(e) => updateSelectedValue(attr.key, e.target.value === 'true')}
            className={valueClass}
            onClick={(e) => e.stopPropagation()}
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        )
      case 'int64':
        return (
          <input
            type="number"
            step="1"
            value={value as number}
            onChange={e => updateSelectedValue(attr.key, parseInt(e.target.value, 10))}
            className={valueClass}
            onClick={(e) => e.stopPropagation()}
          />
        )
      case 'float64':
        return (
          <input
            type="number"
            step="0.1"
            value={value as number}
            onChange={e => updateSelectedValue(attr.key, parseFloat(e.target.value))}
            className={valueClass}
            onClick={(e) => e.stopPropagation()}
          />
        )
      default:
        return (
          <input
            type="text"
            value={value as string}
            onChange={e => updateSelectedValue(attr.key, e.target.value)}
            className={valueClass}
            onClick={(e) => e.stopPropagation()}
          />
        )
    }
  }

  const filteredAttrs = attrs.filter(attr =>
    attr.key.toLowerCase().includes(searchValue.toLowerCase())
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="flex justify-between"
          style={{ width: 'fit-content', minWidth: '150px' }}
        >
          <span className="truncate">User Defined Attrs</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[600px]" align="start">
        <Command>
          <CommandInput
            placeholder="Search..."
            value={searchValue}
            onValueChange={setSearchValue}
            className="h-10 p-1 border border-0 rounded-md focus:ring-0 font-body text-sm"
          />

          <div className="flex gap-2 p-2 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={clearAll}
              className="text-xs flex-1"
            >
              Clear
            </Button>
          </div>

          <CommandEmpty>
            <div className="text-center py-2 text-sm font-display text-accent-foreground">No attributes found</div>
          </CommandEmpty>

          <CommandGroup className="max-h-96 overflow-auto">
            {filteredAttrs.map((attr) => (
              <CommandItem
                key={attr.key}
                onSelect={() => toggleAttr(attr)}
                className="flex flex-col items-start px-4 sm:px-4 px-0 sm:w-full w-fit focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                tabIndex={0}
                onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    toggleAttr(attr)
                  }
                }}
              >
                <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-0">
                  <div className="flex items-center justify-center w-full sm:w-[5%]">
                    {!isAttrSelected(attr) && <Circle className={cn("h-4 w-4 opacity-50")} />}
                    {isAttrSelected(attr) && <CircleCheck className={cn("h-4 w-4")} />}
                  </div>

                  <div className="flex items-center w-full sm:w-[15%]">
                    <span className="font-medium truncate">{attr.key}</span>
                  </div>

                  <div className="flex items-center w-full sm:w-[15%]">
                    <span
                      className={cn(
                        "sm:ml-2 ml-0 text-xs rounded-md px-2 py-1 whitespace-nowrap",
                        isAttrSelected(attr) ? "bg-primary text-primary-foreground" : "bg-background border border-border text-accent-foreground"
                      )}
                    >
                      {attr.type}
                    </span>
                  </div>

                  <div className="flex items-center w-full sm:w-[20%]">
                    <select
                      value={selectedKeyOpMap.get(attr.key)}
                      onChange={(e) => updateSelectedOp(attr.key, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 text-sm bg-background outline-none border border-border rounded-md w-full focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    >
                      {ops.get(attr.type)!.map((op) => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  </div>

                  <div className="w-full sm:w-[45%]">
                    {renderValueInput(attr)}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default UserDefAttrSelector