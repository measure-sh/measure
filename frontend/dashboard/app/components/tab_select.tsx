import React from 'react'

export enum TabSize {
  Large = 'large',
  Small = 'small',
}

export enum TabVariant {
  Default = 'default',
  Underline = 'underline',
}

interface TabSelectProps {
  items: string[]
  selected: string
  size?: TabSize
  variant?: TabVariant
  onChangeSelected?: (item: string) => void
}

const TabSelect: React.FC<TabSelectProps> = ({ items, selected, size = TabSize.Small, variant = TabVariant.Default, onChangeSelected }) => {
  const selectItem = (item: string) => {
    onChangeSelected?.(item)
  }

  return (
    <div className={`flex flex-row gap-1 p-1 ${variant === TabVariant.Default ? 'rounded-lg' : ''} ${size === TabSize.Large ? '' : 'text-xs'}`}>
      {items.map((item) => (
        <button
          key={item}
          onClick={() => selectItem(item)}
          className={`
          px-4 py-2 
          font-display 
          ${variant === TabVariant.Default ? 'rounded-md' : ''}
          ${variant === TabVariant.Default ? 'transition-colors' : ''}
          outline-hidden
          ${selected === item
              ? ` ${variant === TabVariant.Default ? 'bg-neutral-950 text-white' : 'border-b border-neutral-950 text-neutral-800'}`
              : `text-black ${variant === TabVariant.Default ? 'border border-white hover:bg-yellow-200 hover:border-black' : 'hover:border-b hover:border-neutral-800'} focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]`
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