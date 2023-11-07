"use client"

interface FilterPillProps {
  title: string,
}

const FilterPill: React.FC<FilterPillProps> = ({ title }) => {
  return (
    <p className="px-2 py-1 text-white bg-neutral-950 font-display text-sm border border-black rounded-full outline-none">
      {title}
    </p>
    );
};

export default FilterPill;