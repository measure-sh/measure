"use client"

import React, { useState } from 'react'
import { Team } from '../api/api_calls'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from './dropdown_menu'
import { DropdownMenuSeparator } from '@radix-ui/react-dropdown-menu'

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
      <DropdownMenuTrigger className='w-full hover:bg-yellow-200 select-none' disabled={teamsSwitcherStatus === TeamsSwitcherStatus.Loading || teamsSwitcherStatus === TeamsSwitcherStatus.Error}>
        <div className="w-full font-display text-sm border border-black rounded-md truncate p-2 text-left">
          {teamsSwitcherStatus == TeamsSwitcherStatus.Loading && <p>Fetching teams...</p>}
          {teamsSwitcherStatus == TeamsSwitcherStatus.Error && <p>Teams Fetch Error</p>}
          {teamsSwitcherStatus == TeamsSwitcherStatus.Success &&
            <div className="flex flex-row items-center">
              <p className='w-full'>{selectedItem ? selectedItem.name : items![initialItemIndex].name}</p>
              <p className="pl-3 pr-4 pt-1 text-sm">⏷</p>
            </div>
          }
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='select-none'>
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