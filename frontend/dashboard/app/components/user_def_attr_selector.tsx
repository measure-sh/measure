"use client"

import React, { useEffect, useRef, useState } from 'react';
import { UserDefAttr } from '../api/api_calls';

export type UdAttrMatcher = {
  key: string
  type: string
  op: string
  value: string | number | boolean
}

interface UserDefAttrSelectorProps {
  attrs: UserDefAttr[]
  ops: Map<string, string[]>
  onChangeSelected?: (udattrMatchers: UdAttrMatcher[]) => void;
}

const UserDefAttrSelector: React.FC<UserDefAttrSelectorProps> = ({ attrs, ops, onChangeSelected }) => {
  console.log(attrs)
  console.log(ops)
  // Init default ops and values for each key
  const initKeyOpMap: Map<string, string> = new Map()
  const initKeyValMap: Map<string, string | number | boolean> = new Map()
  attrs.forEach((attr) => {
    initKeyOpMap.set(attr.key, ops.get(attr.type)![0])
    let initVal = undefined
    switch (attr.type) {
      case "bool":
        initVal = false
        break;
      case "string":
        initVal = ""
        break;
      default:
        initVal = "0"
        break;
    }
    initKeyValMap.set(attr.key, initVal)
  })

  const [isOpen, setIsOpen] = useState(false);
  const [selectedAttrs, setSelectedAttrs] = useState([] as UserDefAttr[]);
  const [selectedKeyOpMap, setSelectedKeyOpMap] = useState<Map<string, string>>(initKeyOpMap);
  const [selectedKeyValMap, setSelectedKeyValMap] = useState<Map<string, string | number | boolean>>(initKeyValMap);
  const [searchText, setSearchText] = useState('');
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
    setSearchText('')
  };

  const isAttrSelected = (item: UserDefAttr) => {
    return selectedAttrs.some((i) => {
      return item.key === i.key;
    });
  }

  const toggleAttr = (attr: UserDefAttr) => {
    if (isAttrSelected(attr)) {
      setSelectedAttrs(selectedAttrs.filter(a => a != attr))
    } else {
      setSelectedAttrs([attr, ...selectedAttrs])
    }
  };

  const clearAll = () => {
    setSelectedAttrs([]);
  };

  const updateSelectedOp = (key: string, op: string) => {
    setSelectedKeyOpMap((prevMap) => {
      const newMap = new Map(prevMap);
      newMap.set(key, op);
      return newMap;
    });
  }

  const updateSelectedValue = (key: string, val: string | number | boolean) => {
    setSelectedKeyValMap((prevMap) => {
      const newMap = new Map(prevMap);
      newMap.set(key, val);
      return newMap;
    });
  }

  useEffect(() => {
    const udAttrMatchers: UdAttrMatcher[] = [];
    selectedAttrs.forEach((attr) => {
      udAttrMatchers.push({
        key: attr.key,
        type: attr.type,
        op: selectedKeyOpMap.get(attr.key)!,
        value: selectedKeyValMap.get(attr.key)!
      });
    });

    onChangeSelected?.(udAttrMatchers);
  }, [selectedAttrs, ...selectedAttrs.map(attr => selectedKeyOpMap.get(attr.key)), ...selectedAttrs.map(attr => selectedKeyValMap.get(attr.key))]);

  const clearButtonStyle = "text-white text-xs font-display rounded-md border border-white p-1 bg-neutral-950 hover:text-black hover:bg-yellow-200 hover:border-black focus-visible:bg-yellow-200 focus-visible:text-black focus-visible:border-black active:bg-yellow-300 outline-none"
  const checkboxContainerStyle = "flex flex-row items-center px-2 py-2 bg-neutral-950 text-white font-display text-left outline-none hover:text-black hover:bg-yellow-200 focus:text-black focus:bg-yellow-200 active:bg-yellow-300"
  const checkboxInputStyle = "appearance-none pointer-events-none border-white rounded-sm font-display bg-neutral-950 checked:bg-neutral-950 checked:hover:bg-neutral-950 checked:focus:bg-neutral-950 focus:ring-offset-yellow-200 focus:ring-0 checked:ring-1 checked:ring-white"
  const searchInputStyle = "w-full py-2 px-4 bg-neutral-950 text-white text-sm border border-white rounded-md font-sans placeholder:text-gray-400 focus:outline-none focus:border-yellow-300 focus:ring-1 focus:ring-yellow-300"
  const innerDropdownStyle = "px-4 py-2 w-40 border border-white text-white text-sm bg-neutral-950 rounded-md font-sans placeholder:text-gray-400 focus:outline-none focus:border-yellow-300 focus:ring-1 focus:ring-yellow-300"
  const innerOpDropdownStyle = innerDropdownStyle + " ml-2"
  const innerValueDropdownStyle = innerDropdownStyle + " ml-4"
  const valueInputStyle = "py-2 px-4 ml-4 w-40 bg-neutral-950 text-white text-sm border border-white rounded-md font-sans placeholder:text-gray-400 focus:outline-none focus:border-yellow-300 focus:ring-1 focus:ring-yellow-300"

  const renderValueInput = (attr: UserDefAttr) => {
    switch (attr.type) {
      case 'bool':
        return (
          <select
            className={innerValueDropdownStyle}
            value={String(selectedKeyValMap.get(attr.key))}
            onChange={(e) =>
              setSelectedKeyValMap((prevMap) => {
                const newMap = new Map(prevMap);
                newMap.set(attr.key, e.target.value === 'true');
                return newMap;
              })
            }
            onClick={(e) => e.stopPropagation()} // Prevent toggleAttr from being called
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        );
      case 'int64':
        return (
          <input
            type="number"
            step="1"
            className={valueInputStyle}
            value={selectedKeyValMap.get(attr.key) as number}
            onChange={e => updateSelectedValue(attr.key, parseInt(e.target.value, 10))}
            onClick={(e) => e.stopPropagation()} // Prevent toggleAttr from being called
          />
        );
      case 'float64':
        return (
          <input
            type="number"
            step="0.1"
            className={valueInputStyle}
            value={selectedKeyValMap.get(attr.key) as number}
            onChange={e => updateSelectedValue(attr.key, parseFloat(e.target.value))}
            onClick={(e) => e.stopPropagation()} // Prevent toggleAttr from being called
          />
        );
      default:
        return (
          <input
            type="text"
            className={valueInputStyle}
            value={selectedKeyValMap.get(attr.key) as string}
            onChange={(e) => updateSelectedValue(attr.key, e.target.value)}
            onClick={(e) => e.stopPropagation()} // Prevent toggleAttr from being called
          />
        );
    }
  };

  return (
    <div className="relative inline-block text-left select-none" ref={dropdownRef} >
      <div>
        <button
          type="button"
          onClick={toggleDropdown}
          className="inline-flex justify-center w-full font-display border border-black rounded-md outline-none hover:bg-yellow-200 focus:bg-yellow-200 active:bg-yellow-300">
          <span className="px-6 py-2">User Defined Attrs</span>
          <span className="border border-black border-t-0 border-r-0 border-b-0 px-4 py-2">⏷</span>
        </button>
      </div>

      {isOpen && (
        <div className={`z-50 origin-top-right absolute mt-2 w-[600px] max-h-96 overflow-auto rounded-md shadow-lg ring-1 ring-black ring-opacity-5 ${dropdownRef.current && dropdownRef.current.getBoundingClientRect().left > window.innerWidth / 2 ? 'right-0' : 'left-0'}`}>
          <div
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="options-menu"
          >
            <div>
              {attrs.length > 1 && <div className='w-full p-2 bg-neutral-950'>
                <input
                  type="text"
                  id="user-def-attr-search"
                  placeholder='Search...'
                  className={searchInputStyle}
                  onChange={(e) => {
                    setSearchText(e.target.value)
                  }}
                />
              </div>}
              {attrs.length > 1 && <div className='flex flex-row w-full p-2 bg-neutral-950'>
                <button
                  onClick={() => clearAll()}
                  className={clearButtonStyle}
                >
                  Clear
                </button>
              </div>}
              {attrs.filter((attr) => attr.key.toLocaleLowerCase().includes(searchText.toLocaleLowerCase())).map((attr) => (
                <div
                  key={attr.key}
                  className={checkboxContainerStyle}
                  role="menuitem"
                  tabIndex={0}
                  onClick={(e) => {
                    toggleAttr(attr);
                    (e.currentTarget as HTMLElement).blur()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggleAttr(attr);
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    className={checkboxInputStyle}
                    value={attr.key}
                    checked={isAttrSelected(attr)}
                    readOnly
                    tabIndex={-1}
                  />
                  <div className='flex flex-row items-center ml-2 w-56'>
                    <p className="truncate">{attr.key}</p>
                    <p className='ml-2 text-xs rounded-md bg-sky-500 p-1'>{attr.type}</p>
                  </div>
                  <select
                    value={selectedKeyOpMap.get(attr.key)}
                    onChange={(e) => updateSelectedOp(attr.key, e.target.value)}
                    onClick={(e) => e.stopPropagation()} // Prevent toggleAttr from being called
                    className={innerOpDropdownStyle}
                  >
                    {ops.get(attr.type)!.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                  {renderValueInput(attr)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDefAttrSelector;