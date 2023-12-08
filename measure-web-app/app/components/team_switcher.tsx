"use client"

import React, { useEffect, useRef, useState } from 'react';

interface TeamSwitcherProps {
  items: string[];
  initialItemIndex?: number;
  onChangeSelectedItem?: (item: string) => void;
}

const TeamSwitcher: React.FC<TeamSwitcherProps> = ({ items, initialItemIndex = 0, onChangeSelectedItem }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const TeamSwitcherRef = useRef<HTMLDivElement | null>(null);


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        TeamSwitcherRef.current &&
        !TeamSwitcherRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (
        TeamSwitcherRef.current &&
        !TeamSwitcherRef.current.contains(event.target as Node)
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
    <div className="z-50 relative w-40 self-center inline-block text-left" ref={TeamSwitcherRef} >
      <button
        type="button"
        onClick={toggleTeamSwitcher}
        className="aspect-square w-full text-xl font-display border border-black rounded-full outline-none hover:bg-yellow-200 focus:bg-yellow-200 active:bg-yellow-300">
        <div className="flex flex-row items-center">
          <p className="pl-8 truncate">{selectedItem ? selectedItem : items[initialItemIndex]}</p>
          <p className="pl-3 pr-4 text-sm">⏷</p>
        </div>
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