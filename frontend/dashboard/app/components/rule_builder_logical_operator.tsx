"use client"

const RuleBuilderLogicalOperator = ({
    value,
    onChange
}: {
    value: 'AND' | 'OR';
    onChange: (operator: 'AND' | 'OR') => void;
}) => {
    return (
        <div className="flex items-center justify-center relative py-10">
            {/* Top connecting line */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-px h-10 bg-sky-100"></div>

            {/* Circular toggle button */}
            <button
                type="button"
                onClick={() => onChange(value === 'AND' ? 'OR' : 'AND')}
                className={`relative z-10 w-12 h-12 rounded-full border transition-colors flex items-center justify-center text-sm font-sans hover:bg-yellow-200 border-sky-100`}
            >
                {value}
            </button>

            {/* Bottom connecting line */}
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-px h-10 bg-sky-100"></div>
        </div>
    );
};

export default RuleBuilderLogicalOperator;
