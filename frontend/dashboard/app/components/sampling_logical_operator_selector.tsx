"use client"

const SamplingLogicalOperatorSelector = ({
    value,
    onChange
}: {
    value: 'AND' | 'OR';
    onChange: (operator: 'AND' | 'OR') => void;
}) => {
    // Color styles for AND/OR - using consistent green theme
    const colorClasses = "bg-green-100 hover:bg-green-200 border-green-300 text-green-800";

    return (
        <div className="flex items-center justify-center relative py-10">
            {/* Top connecting line */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-px h-12 bg-gray-300"></div>
            
            {/* Circular toggle button */}
            <button
                type="button"
                onClick={() => onChange(value === 'AND' ? 'OR' : 'AND')}
                className={`relative z-10 w-12 h-12 rounded-full border transition-colors flex items-center justify-center text-sm font-sans ${colorClasses}`}
            >
                {value}
            </button>
            
            {/* Bottom connecting line */}
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-px h-12 bg-gray-300"></div>
        </div>
    );
};

export default SamplingLogicalOperatorSelector;
