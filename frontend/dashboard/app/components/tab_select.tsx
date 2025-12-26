import React from 'react'

export enum TabSize {
  Large = 'large',
  Small = 'small',
}

interface TabSelectProps {
  items: string[]
  selected: string
  size?: TabSize
  onChangeSelected?: (item: string) => void
}

const TabSelect: React.FC<TabSelectProps> = ({ items, selected, size = TabSize.Small, onChangeSelected }) => {
  const selectItem = (item: string) => {
    onChangeSelected?.(item)
  }

  return (
    <div className={`flex flex-row gap-1 p-1 ${size === TabSize.Large ? '' : 'text-xs'}`}>
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
          focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]
          
          ${selected === item
              ? `bg-accent text-accent-foreground`
              : `bg-background text-foreground hover:bg-accent hover:text-accent-foreground`
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