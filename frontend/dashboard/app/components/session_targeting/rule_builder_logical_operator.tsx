"use client"

const RuleBuilderLogicalOperator = ({
    value,
    onChange
}: {
    value: 'AND' | 'OR';
    onChange: (operator: 'AND' | 'OR') => void;
}) => {
    return (
        <div className="flex items-center justify-center relative py-12">
            {/* Top connecting line */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-px h-12 bg-neutral-300"></div>

            {/* Circular toggle button */}
            <button
                type="button"
                onClick={() => onChange(value === 'AND' ? 'OR' : 'AND')}
                className={`relative z-10 w-12 h-12 rounded-full border transition-colors flex items-center justify-center text-sm font-sans hover:bg-yellow-200 border-neutral-300`}
            >
                {value}
            </button>

            {/* Bottom connecting line */}
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-px h-12 bg-neutral-300"></div>
        </div>
    );
};

export default RuleBuilderLogicalOperator;
