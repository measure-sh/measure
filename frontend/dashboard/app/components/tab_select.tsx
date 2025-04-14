import React from 'react'

interface TabSelectProps {
  items: string[]
  selected: string
  onChangeSelected?: (item: string) => void
}

const TabSelect: React.FC<TabSelectProps> = ({ items, selected, onChangeSelected }) => {
  const selectItem = (item: string) => {
    onChangeSelected?.(item)
  }

  return (
    <div className="flex flex-row gap-1 p-1 rounded-lg text-xs">
      {items.map((item) => (
        <button
          key={item}
          onClick={() => selectItem(item)}
          className={`
          px-4 py-2 
          font-display 
          rounded-md 
          transition-colors
          outline-hidden
          ${selected === item
              ? 'bg-neutral-950 text-white'
              : 'text-black border border-white hover:bg-yellow-200 hover:border-black focus:bg-yellow-200 focus:border-black'
            }
        `}
        >
          {item}
        </button>
      ))}
    </div>
  )
}

export default TabSelect