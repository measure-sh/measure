"use client"

const SamplingLogicalOperatorSelector = ({
    value,
    onChange
}: {
    value: 'AND' | 'OR';
    onChange: (operator: 'AND' | 'OR') => void;
}) => {
    return (
        <div className="flex items-center py-2">
            <div className="flex border border-black rounded-md overflow-hidden">
                <button
                    type="button"
                    onClick={() => onChange('AND')}
                    className={`px-3 py-1 text-sm transition-colors ${value === 'AND'
                            ? 'bg-yellow-200 text-black'
                            : 'bg-white text-black hover:bg-gray-50'
                        }`}
                >
                    AND
                </button>
                <button
                    type="button"
                    onClick={() => onChange('OR')}
                    className={`px-3 py-1 text-sm border-l border-black transition-colors ${value === 'OR'
                            ? 'bg-yellow-200 text-black'
                            : 'bg-white text-black hover:bg-gray-50'
                        }`}
                >
                    OR
                </button>
            </div>
        </div>
    );
};

export default SamplingLogicalOperatorSelector;
