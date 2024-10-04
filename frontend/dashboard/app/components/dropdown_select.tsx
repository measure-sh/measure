"use client"

import React, { useEffect, useRef, useState } from 'react';
import { AppVersion, OsVersion } from '../api/api_calls';

export enum DropdownSelectType {
  SingleString,
  MultiString,
  SingleAppVersion,
  MultiAppVersion,
  SingleOsVersion,
  MultiOsVersion
}

interface DropdownSelectProps {
  type: DropdownSelectType;
  title: string;
  items: string[] | AppVersion[] | OsVersion[];
  initialSelected: string | AppVersion | OsVersion | string[] | AppVersion[] | OsVersion[];
  onChangeSelected?: (item: string | AppVersion | OsVersion | string[] | AppVersion[] | OsVersion[]) => void;
}

const DropdownSelect: React.FC<DropdownSelectProps> = ({ title, type, items, initialSelected, onChangeSelected }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState(initialSelected);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selected !== initialSelected) {
      setSelected(initialSelected)
    }
  }, [initialSelected]);

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

  const selectSingleItem = (item: string | AppVersion | OsVersion) => {
    setSelected(item);
    setIsOpen(false);
  };

  const selectAll = () => {
    setSelected(items)
  };

  const selectLatestAppVersion = () => {
    // find version with highest build number
    let versions = items as AppVersion[]
    let latestVersion = versions.reduce((highest, current) =>
      parseInt(current.code) > parseInt(highest.code) ? current : highest
    )

    setSelected([latestVersion])
  };

  const toggleCheckboxStringItem = (item: string) => {
    let curSelected = selected as string[]
    if (curSelected.includes(item)) {
      // If only one item is selected, do nothing
      if (curSelected.length === 1) {
        return
      }
      setSelected(curSelected.filter(a => a != item))
    } else {
      setSelected([item, ...curSelected])
    }
  };

  const isOsVersionSelected = (item: OsVersion) => {
    return (selected as OsVersion[]).some((i) => {
      return item.displayName === i.displayName;
    });
  }

  const toggleCheckboxOsVersionItem = (item: OsVersion) => {
    let curSelected = selected as OsVersion[]
    if (isOsVersionSelected(item)) {
      // If only one item is selected, do nothing
      if (curSelected.length === 1) {
        return
      }
      setSelected(curSelected.filter(a => a != item))
    } else {
      setSelected([item, ...curSelected])
    }
  };

  const isAppVersionSelected = (item: AppVersion) => {
    return (selected as AppVersion[]).some((i) => {
      return item.displayName === i.displayName;
    });
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
  };

  useEffect(() => {
    onChangeSelected?.(selected);
  }, [selected]);

  const buttonStyle = "block px-2 py-2 w-full truncate text-white bg-neutral-950 hover:text-black font-display text-left hover:bg-yellow-200 active:bg-yellow-300 outline-none focus:bg-yellow-200"
  const groupSelectButtonStyle = "text-white text-xs font-display rounded-md border border-white p-1 bg-neutral-950 hover:text-black hover:bg-yellow-200 hover:border-black focus-visible:bg-yellow-200 focus-visible:text-black focus-visible:border-black active:bg-yellow-300 outline-none"
  const checkboxContainerStyle = "px-2 py-2 bg-neutral-950 truncate text-white hover:text-black hover:bg-yellow-200 font-display text-left"
  const checkboxInputStyle = "appearance-none border-white rounded-sm font-display bg-neutral-950 checked:bg-neutral-950 checked:hover:bg-neutral-950 checked:focus:bg-neutral-950 focus:ring-offset-yellow-200 focus:ring-0 checked:ring-1 checked:ring-white"

  return (
    <div className="relative inline-block text-left" ref={dropdownRef} >
      <div>
        <button
          type="button"
          onClick={toggleDropdown}
          className="inline-flex justify-center w-full font-display border border-black rounded-md outline-none hover:bg-yellow-200 focus:bg-yellow-200 active:bg-yellow-300">
          {type === DropdownSelectType.SingleString && <span className="px-6 py-2">{selected as string}</span>}
          {type === DropdownSelectType.SingleAppVersion && <span className="px-6 py-2">{(selected as AppVersion).displayName}</span>}
          {type === DropdownSelectType.SingleOsVersion && <span className="px-6 py-2">{(selected as OsVersion).displayName}</span>}
          {(type == DropdownSelectType.MultiString || type === DropdownSelectType.MultiAppVersion || type === DropdownSelectType.MultiOsVersion) && <span className="px-6 py-2">{title}</span>}
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
            {type === DropdownSelectType.SingleString && items.map((item) => (
              <button
                key={item as string}
                onClick={() => selectSingleItem(item as string)}
                className={buttonStyle}
                role="menuitem"
              >
                {item as string}
              </button>
            ))}
            {type === DropdownSelectType.SingleAppVersion && items.map((item) => (
              <button
                key={(item as AppVersion).displayName}
                onClick={() => selectSingleItem(item as AppVersion)}
                className={buttonStyle}
                role="menuitem"
              >
                {(item as AppVersion).displayName}
              </button>
            ))}
            {type === DropdownSelectType.SingleOsVersion && items.map((item) => (
              <button
                key={(item as OsVersion).displayName}
                onClick={() => selectSingleItem(item as OsVersion)}
                className={buttonStyle}
                role="menuitem"
              >
                {(item as OsVersion).displayName}
              </button>
            ))}
            {type === DropdownSelectType.MultiString &&
              <div>
                {(items as string[]).length > 1 && <div className='flex flex-row w-full p-2 bg-neutral-950'>
                  <button
                    onClick={() => selectAll()}
                    className={groupSelectButtonStyle}
                  >
                    All
                  </button>
                </div>}
                {items.map((item) => (
                  <div key={item as string} className={checkboxContainerStyle} role="menuitem">
                    <input
                      type="checkbox"
                      className={checkboxInputStyle}
                      value={item as string}
                      checked={(selected as string[]).includes(item as string)}
                      onChange={() => { toggleCheckboxStringItem(item as string) }}
                    />
                    <span className="ml-2">{item as string}</span>
                  </div>
                ))}
              </div>
            }
            {type === DropdownSelectType.MultiOsVersion &&
              <div>
                {(items as OsVersion[]).length > 1 && <div className='flex flex-row w-full p-2 bg-neutral-950'>
                  <button
                    onClick={() => selectAll()}
                    className={groupSelectButtonStyle}
                  >
                    All
                  </button>
                </div>}
                {items.map((item) => (
                  <div key={item as string} className={checkboxContainerStyle} role="menuitem">
                    <input
                      type="checkbox"
                      className={checkboxInputStyle}
                      value={(item as OsVersion).displayName}
                      checked={isOsVersionSelected(item as OsVersion)}
                      onChange={() => { toggleCheckboxOsVersionItem(item as OsVersion) }}
                    />
                    <span className="ml-2">{(item as OsVersion).displayName}</span>
                  </div>
                ))}
              </div>
            }
            {type === DropdownSelectType.MultiAppVersion &&
              <div>
                {(items as AppVersion[]).length > 1 && <div className='flex flex-row w-full p-2 bg-neutral-950'>
                  <button
                    onClick={() => selectAll()}
                    className={groupSelectButtonStyle}
                  >
                    All
                  </button>
                  <div className="px-1" />
                  <button
                    onClick={() => selectLatestAppVersion()}
                    className={groupSelectButtonStyle}
                  >
                    Latest
                  </button>
                </div>}
                {items.map((item) => (
                  <div key={(item as AppVersion).displayName} className={checkboxContainerStyle} role="menuitem">
                    <input
                      type="checkbox"
                      className={checkboxInputStyle}
                      value={(item as AppVersion).displayName}
                      checked={isAppVersionSelected(item as AppVersion)}
                      onChange={() => { toggleCheckboxAppVersionItem(item as AppVersion) }}
                    />
                    <span className="ml-2">{(item as AppVersion).displayName}</span>
                  </div>
                ))}
              </div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default DropdownSelect;