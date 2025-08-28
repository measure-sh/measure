"use client"

const SamplingLogicalOperatorSelector = ({
    value,
    onChange
}: {
    value: 'AND' | 'OR';
    onChange: (operator: 'AND' | 'OR') => void;
}) => {
    return (
        <div className="flex items-center relative py-4">
            {/* Top connecting line */}
            <div className="absolute top-0 left-5 transform -translate-x-1/2 w-px h-4 bg-gray-300"></div>
            
            {/* Circular toggle button */}
            <button
                type="button"
                onClick={() => onChange(value === 'AND' ? 'OR' : 'AND')}
                className="relative z-10 w-10 h-10 rounded-full border border-gray-300 bg-yellow-200 hover:bg-yellow-300 transition-colors flex items-center justify-center text-sm font-body text-black"
            >
                {value}
            </button>
            
            {/* Bottom connecting line */}
            <div className="absolute bottom-0 left-5 transform -translate-x-1/2 w-px h-4 bg-gray-300"></div>
        </div>
    );
};

export default SamplingLogicalOperatorSelector;