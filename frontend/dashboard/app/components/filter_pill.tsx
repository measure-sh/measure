"use client"

interface FilterPillProps {
  title: string,
}

const tooltipChars = 1000

const FilterPill: React.FC<FilterPillProps> = ({ title }) => {
  return (
    <div className="group relative select-none">
      <p className="px-2 py-1 max-w-72 whitespace-nowrap text-ellipsis overflow-hidden text-white bg-neutral-950 font-display text-sm border border-black rounded-full outline-none transition ease-in-out transition-colors duration-100">
        {title}
      </p>
      <span className="pointer-events-none z-50 absolute max-w-xl w-max font-sans text-xs text-white rounded-md p-4 bg-neutral-800 left-0 top-0 transform translate-y-8 opacity-0 transition-opacity group-hover:opacity-100">
        {title.length <= tooltipChars ? title : title.slice(0, tooltipChars) + "..."}
      </span>
    </div>
  );
};

export default FilterPill;