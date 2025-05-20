"use client"

import React, { useState } from 'react'
import { Team } from '../api/api_calls'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from './dropdown_menu'
import { DropdownMenuSeparator } from '@radix-ui/react-dropdown-menu'
import { ChevronsUpDown } from 'lucide-react'
import { Button } from './button'

export enum TeamsSwitcherStatus {
  Loading,
  Success,
  Error
}

interface TeamSwitcherProps {
  items: Team[] | null
  initialItemIndex?: number
  teamsSwitcherStatus: TeamsSwitcherStatus
  onChangeSelectedItem?: (item: Team) => void
}

const TeamSwitcher: React.FC<TeamSwitcherProps> = ({ items, initialItemIndex = 0, teamsSwitcherStatus, onChangeSelectedItem }) => {
  const [selectedItem, setSelectedItem] = useState<Team | null>(null)

  const selectItem = (item: Team) => {
    setSelectedItem(item)
    if (onChangeSelectedItem) {
      onChangeSelectedItem(item)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className='w-full select-none'>
        <Button
          variant="outline"
          className="flex justify-between w-full font-display border border-black rounded-md select-none"
          disabled={teamsSwitcherStatus === TeamsSwitcherStatus.Loading || teamsSwitcherStatus === TeamsSwitcherStatus.Error}
        >
          {teamsSwitcherStatus == TeamsSwitcherStatus.Loading && <p>Fetching teams...</p>}
          {teamsSwitcherStatus == TeamsSwitcherStatus.Error && <p>Teams Fetch Error</p>}
          {teamsSwitcherStatus == TeamsSwitcherStatus.Success && <span className="truncate">{selectedItem ? selectedItem.name : items![initialItemIndex].name}</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className='select-none'
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DropdownMenuLabel className='font-display'>Select Team</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {teamsSwitcherStatus === TeamsSwitcherStatus.Success && items?.map((item, index) => (
          <DropdownMenuItem key={index} onClick={() => selectItem(item)} className='font-body'>
            {item.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default TeamSwitcher