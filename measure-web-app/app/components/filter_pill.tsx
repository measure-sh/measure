"use client"

interface FilterPillProps {
  title: string,
}

const FilterPill: React.FC<FilterPillProps> = ({ title }) => {
  return (
    <button
      type="button"
      className="px-2 py-1 text-white hover:text-black focus:text-black bg-neutral-950 font-display text-sm border border-black rounded-full outline-none hover:bg-yellow-200 focus:bg-yellow-200 active:bg-yellow-300"
    >
      {title} x
    </button>
    );
};

export default FilterPill;