"use client"

import React, { useEffect, useRef, useState } from 'react';
import { AppVersion } from '../api/api_calls';

interface AppVersionDropdownProps {
  items: AppVersion[];
  initialSelectedItem: AppVersion;
  onChangeSelectedItem?: (item: AppVersion) => void;
}

const AppVersionDropdown: React.FC<AppVersionDropdownProps> = ({ items, initialSelectedItem, onChangeSelectedItem }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(initialSelectedItem);
  const dropdownRef = useRef<HTMLDivElement | null>(null);


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
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

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const selectItem = (item: AppVersion) => {
    setSelectedItem(item);
    setIsOpen(false);
    if (onChangeSelectedItem) {
      onChangeSelectedItem(item);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef} >
      <div>
        <button
          type="button"
          onClick={toggleDropdown}
          className="inline-flex justify-center w-full font-display border border-black rounded-md outline-none hover:bg-yellow-200 focus:bg-yellow-200 active:bg-yellow-300">
          <span className="px-6 py-2">{selectedItem.displayName}</span>
          <span className="border border-black border-t-0 border-r-0 border-b-0 px-4 py-2">⏷</span>
        </button>
      </div>

      {isOpen && (
        <div className="z-50 origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg ring-1 ring-black ring-opacity-5">
          <div
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="options-menu"
          >
            {items.map((item) => (
              <button
                key={item.displayName}
                onClick={() => selectItem(item)}
                className="block w-full px-2 py-2 text-white bg-neutral-950 hover:text-black font-display text-left hover:bg-yellow-200 active:bg-yellow-300 outline-none focus:bg-yellow-200"
                role="menuitem"
              >
                {item.displayName}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AppVersionDropdown;