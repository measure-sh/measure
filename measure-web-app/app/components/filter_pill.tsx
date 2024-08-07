"use client"

interface FilterPillProps {
  title: string,
}

const FilterPill: React.FC<FilterPillProps> = ({ title }) => {
  return (
    <div className="group relative select-none">
      <p className="px-2 py-1 max-w-72 whitespace-nowrap text-ellipsis overflow-hidden text-white bg-neutral-950 font-display text-sm border border-black rounded-full outline-none transition ease-in-out transition-colors duration-100">
        {title}
      </p>
      <span className="pointer-events-none z-50 max-w-xl absolute font-sans text-sm text-white rounded-md p-4 bg-neutral-800 top-8 left-0 w-max opacity-0 transition-opacity group-hover:opacity-100">
        {title}
      </span>
    </div>
  );
};

export default FilterPill;