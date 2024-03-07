"use client"

import React, { useEffect, useRef, useState } from 'react';
import { TeamsApiStatus } from '../api/api_calls';

interface TeamSwitcherProps {
  items: string[];
  initialItemIndex?: number;
  teamsApiStatus: TeamsApiStatus;
  onChangeSelectedItem?: (item: string) => void;
}

const TeamSwitcher: React.FC<TeamSwitcherProps> = ({ items, initialItemIndex = 0, teamsApiStatus, onChangeSelectedItem }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const teamSwitcherRef = useRef<HTMLDivElement | null>(null);


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        teamSwitcherRef.current &&
        !teamSwitcherRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (
        teamSwitcherRef.current &&
        !teamSwitcherRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('focusin', handleFocusIn);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, []);

  const toggleTeamSwitcher = () => {
    setIsOpen(!isOpen);
  };

  const selectItem = (item: string) => {
    setSelectedItem(item);
    setIsOpen(false);
    if (onChangeSelectedItem) {
      onChangeSelectedItem(item);
    }
  };

  return (
    <div className="z-50 relative w-40 self-center inline-block text-left" ref={teamSwitcherRef} >
      <button
        type="button"
        onClick={toggleTeamSwitcher}
        disabled={teamsApiStatus === TeamsApiStatus.Loading || teamsApiStatus === TeamsApiStatus.Error}
        className="aspect-square w-full text-xl font-display border border-black rounded-full outline-none hover:bg-yellow-200 focus:bg-yellow-200 active:bg-yellow-300">
        {teamsApiStatus == TeamsApiStatus.Loading && <p className="pl-8 truncate w-max">Updating...</p>}
        {teamsApiStatus == TeamsApiStatus.Error && <p className="pl-8 truncate w-max">Error</p>}
        {teamsApiStatus == TeamsApiStatus.Success &&
          <div className="flex flex-row justify-center">
            <p className="pl-8 truncate w-max">{selectedItem ? selectedItem : items[initialItemIndex]}</p>
            <p className="pl-3 pr-4 pt-1 text-sm">⏷</p>
          </div>}
      </button>

      {isOpen && (
        <div className="origin-top-right absolute left-0 mt-2 w-48 rounded-md shadow-lg ring-1 ring-black ring-opacity-5">
          <div
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="options-menu"
          >
            {items.map((item) => (
              <button
                key={item}
                onClick={() => selectItem(item)}
                className="block w-full px-2 py-2 text-white bg-neutral-950 font-display text-left hover:text-black hover:bg-yellow-200 active:bg-yellow-300 outline-none focus:bg-yellow-200"
                role="menuitem"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamSwitcher;