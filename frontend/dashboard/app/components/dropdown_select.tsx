"use client"

import React, { useEffect, useRef, useState } from 'react'
import { AppVersion, OsVersion } from '../api/api_calls'

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
  const [isOpen, setIsOpen] = useState(false)
  const [selected, setSelected] = useState(initialSelected)
  const [searchText, setSearchText] = useState('')
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (selected !== initialSelected) {
      setSelected(initialSelected)
    }
  }, [initialSelected])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    const handleFocusIn = (event: FocusEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('focusin', handleFocusIn)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('focusin', handleFocusIn)
    }
  }, [])

  const toggleDropdown = () => {
    setIsOpen(!isOpen)
    setSearchText('')
  }

  const selectSingleItem = (item: string | AppVersion | OsVersion) => {
    setSelected(item)
    setIsOpen(false)
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
  }, [selected])

  const buttonStyle = "block px-2 py-2 w-full truncate text-white bg-neutral-950 hover:text-black font-display text-left hover:bg-yellow-200 active:bg-yellow-300 outline-hidden focus:bg-yellow-200"
  const groupSelectButtonStyle = "text-white text-xs font-display rounded-md border border-white p-1 bg-neutral-950 hover:text-black hover:bg-yellow-200 hover:border-black focus-visible:bg-yellow-200 focus-visible:text-black focus-visible:border-black active:bg-yellow-300 outline-hidden"
  const checkboxContainerStyle = "px-2 py-2 bg-neutral-950 truncate text-white font-display text-left outline-hidden hover:text-black hover:bg-yellow-200 focus:text-black focus:bg-yellow-200 active:bg-yellow-300"
  const checkboxInputStyle = "appearance-none pointer-events-none border-white rounded-xs font-display bg-neutral-950 checked:bg-neutral-950 checked:hover:bg-neutral-950 checked:focus:bg-neutral-950 focus:ring-offset-yellow-200 focus:ring-0 checked:ring-1 checked:ring-white"
  const searchInputStyle = "w-full bg-neutral-950 text-white text-sm border border-white rounded-md py-2 px-4 font-body placeholder:text-gray-400 focus:outline-hidden focus:border-yellow-300 focus:ring-1 focus:ring-yellow-300"

  return (
    <div className="relative inline-block text-left select-none" ref={dropdownRef} >
      <div>
        <button
          type="button"
          onClick={toggleDropdown}
          className="inline-flex justify-center w-full font-display border border-black rounded-md outline-hidden hover:bg-yellow-200 focus:bg-yellow-200 active:bg-yellow-300">
          {type === DropdownSelectType.SingleString && <span className="px-6 py-2">{selected as string}</span>}
          {type === DropdownSelectType.SingleAppVersion && <span className="px-6 py-2">{(selected as AppVersion).displayName}</span>}
          {type === DropdownSelectType.SingleOsVersion && <span className="px-6 py-2">{(selected as OsVersion).displayName}</span>}
          {(type == DropdownSelectType.MultiString || type === DropdownSelectType.MultiAppVersion || type === DropdownSelectType.MultiOsVersion) && <span className="px-6 py-2">{title}</span>}
          <span className="border border-black border-t-0 border-r-0 border-b-0 px-4 py-2">⏷</span>
        </button>
      </div>

      {isOpen && (
        <div className="z-50 origin-top-right absolute left-0 mt-2 w-fit min-w-48 max-h-96 overflow-auto rounded-md shadow-lg ring-1 ring-black ring-opacity-5">
          <div
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="options-menu"
          >
            {type === DropdownSelectType.SingleString &&
              <div>
                {(items as string[]).length > 1 && <div className='w-full p-2 bg-neutral-950'>
                  <input
                    type="text"
                    id="single-string-search"
                    placeholder='Search...'
                    className={searchInputStyle}
                    onChange={(e) => {
                      setSearchText(e.target.value)
                    }}
                  />
                </div>}
                {items.filter((item) => (item as string).toLowerCase().includes(searchText.toLowerCase())).map((item) => (
                  <button
                    key={item as string}
                    onClick={() => selectSingleItem(item as string)}
                    className={buttonStyle}
                    role="menuitem"
                  >
                    {item as string}
                  </button>
                ))}
              </div>
            }
            {type === DropdownSelectType.SingleAppVersion &&
              <div>
                {(items as AppVersion[]).length > 1 && <div className='w-full p-2 bg-neutral-950'>
                  <input
                    type="text"
                    id="single-app-version-search"
                    placeholder='Search...'
                    className={searchInputStyle}
                    onChange={(e) => {
                      setSearchText(e.target.value)
                    }}
                  />
                </div>}
                {items.filter((item) => (item as AppVersion).displayName.toLowerCase().includes(searchText.toLowerCase())).map((item) => (
                  <button
                    key={(item as AppVersion).displayName}
                    onClick={() => selectSingleItem(item as AppVersion)}
                    className={buttonStyle}
                    role="menuitem"
                  >
                    {(item as AppVersion).displayName}
                  </button>
                ))}
              </div>
            }
            {type === DropdownSelectType.SingleOsVersion &&
              <div>
                {(items as OsVersion[]).length > 1 && <div className='w-full p-2 bg-neutral-950'>
                  <input
                    type="text"
                    id="single-os-version-search"
                    placeholder='Search...'
                    className={searchInputStyle}
                    onChange={(e) => {
                      setSearchText(e.target.value)
                    }}
                  />
                </div>}
                {items.filter((item) => (item as OsVersion).displayName.toLowerCase().includes(searchText.toLowerCase())).map((item) => (
                  <button
                    key={(item as OsVersion).displayName}
                    onClick={() => selectSingleItem(item as OsVersion)}
                    className={buttonStyle}
                    role="menuitem"
                  >
                    {(item as OsVersion).displayName}
                  </button>
                ))}
              </div>
            }
            {type === DropdownSelectType.MultiString &&
              <div>
                {(items as string[]).length > 1 && <div className='w-full p-2 bg-neutral-950'>
                  <input
                    type="text"
                    id="multi-string-search"
                    placeholder='Search...'
                    className={searchInputStyle}
                    onChange={(e) => {
                      setSearchText(e.target.value)
                    }}
                  />
                </div>}
                {(items as string[]).length > 1 && <div className='flex flex-row w-full p-2 bg-neutral-950'>
                  <button
                    onClick={() => selectAll()}
                    className={groupSelectButtonStyle}
                  >
                    All
                  </button>
                  <div className="px-1" />
                  <button
                    onClick={() => clearAll()}
                    className={groupSelectButtonStyle}
                  >
                    Clear
                  </button>
                </div>}
                {items.filter((item) => (item as string).toLocaleLowerCase().includes(searchText.toLocaleLowerCase())).map((item) => (
                  <div
                    key={item as string}
                    className={checkboxContainerStyle}
                    role="menuitem"
                    tabIndex={0}
                    onClick={(e) => {
                      toggleCheckboxStringItem(item as string);
                      (e.currentTarget as HTMLElement).blur()
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggleCheckboxStringItem(item as string)
                      }
                    }}
                  >
                    <input
                      type="checkbox"
                      className={checkboxInputStyle}
                      value={item as string}
                      checked={(selected as string[]).includes(item as string)}
                      readOnly
                      tabIndex={-1}
                    />
                    <span className="ml-2">{item as string}</span>
                  </div>
                ))}
              </div>
            }
            {type === DropdownSelectType.MultiOsVersion &&
              <div>
                {(items as OsVersion[]).length > 1 && <div className='w-full p-2 bg-neutral-950'>
                  <input
                    type="text"
                    id="multi-os-version-search"
                    placeholder='Search...'
                    className={searchInputStyle}
                    onChange={(e) => {
                      setSearchText(e.target.value)
                    }}
                  />
                </div>}
                {(items as OsVersion[]).length > 1 && <div className='flex flex-row w-full p-2 bg-neutral-950'>
                  <button
                    onClick={() => selectAll()}
                    className={groupSelectButtonStyle}
                  >
                    All
                  </button>
                  <div className="px-1" />
                  <button
                    onClick={() => clearAll()}
                    className={groupSelectButtonStyle}
                  >
                    Clear
                  </button>
                </div>}
                {items.filter((item) => (item as OsVersion).displayName.toLocaleLowerCase().includes(searchText.toLocaleLowerCase())).map((item, idx) => (
                  <div
                    key={`${idx}-${item as string}`}
                    className={checkboxContainerStyle}
                    role="menuitem"
                    tabIndex={0}
                    onClick={(e) => {
                      toggleCheckboxOsVersionItem(item as OsVersion);
                      (e.currentTarget as HTMLElement).blur()
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggleCheckboxOsVersionItem(item as OsVersion)
                      }
                    }}
                  >
                    <input
                      type="checkbox"
                      className={checkboxInputStyle}
                      value={(item as OsVersion).displayName}
                      checked={isOsVersionSelected(item as OsVersion)}
                      readOnly
                      tabIndex={-1}
                    />
                    <span className="ml-2">{(item as OsVersion).displayName}</span>
                  </div>
                ))}
              </div>
            }
            {type === DropdownSelectType.MultiAppVersion &&
              <div>
                {(items as AppVersion[]).length > 1 && <div className='w-full p-2 bg-neutral-950'>
                  <input
                    type="text"
                    id="multi-app-version-search"
                    placeholder='Search...'
                    className={searchInputStyle}
                    onChange={(e) => {
                      setSearchText(e.target.value)
                    }}
                  />
                </div>}
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
                {items.filter((item) => (item as AppVersion).displayName.toLocaleLowerCase().includes(searchText.toLocaleLowerCase())).map((item) => (
                  <div
                    key={(item as AppVersion).displayName}
                    className={checkboxContainerStyle}
                    role="menuitem"
                    tabIndex={0}
                    onClick={(e) => {
                      toggleCheckboxAppVersionItem(item as AppVersion);
                      (e.currentTarget as HTMLElement).blur()
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggleCheckboxAppVersionItem(item as AppVersion)
                      }
                    }}
                  >
                    <input
                      type="checkbox"
                      className={checkboxInputStyle}
                      value={(item as AppVersion).displayName}
                      checked={isAppVersionSelected(item as AppVersion)}
                      readOnly
                      tabIndex={-1}
                    />
                    <span className="ml-2">{(item as OsVersion).displayName}</span>
                  </div>
                ))}
              </div>}
          </div>
        </div>
      )}
    </div>
  )
}

export default DropdownSelect