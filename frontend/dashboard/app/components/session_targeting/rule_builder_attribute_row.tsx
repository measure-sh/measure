"use client"

import DropdownSelect, { DropdownSelectType } from '@/app/components/dropdown_select';
import { Button } from '@/app/components/button';
import { X } from 'lucide-react';

type AttrType = 'attrs' | 'ud_attrs';

const getTypeDisplayName = (type: string): string => {
    const typeMap: { [key: string]: string } = {
        'float64': 'decimal',
        'int64': 'number',
        'number': 'number',
        'string': 'text'
    };

    return typeMap[type] || type;
};

const RuleBuilderAttributeRow = ({
    attr,
    conditionId,
    attrType,
    attrKeys,
    operatorTypesMapping,
    getOperatorsForType,
    onUpdateAttr,
    onRemoveAttr,
    showDeleteButton = true
}: {
    attr: { id: string; key: string; type: string; value: string | boolean | number; operator?: string; hasError?: boolean; errorMessage?: string; hint?: string };
    conditionId: string;
    attrType: AttrType;
    attrKeys: string[];
    operatorTypesMapping: any;
    getOperatorsForType: (mapping: any, type: string) => string[];
    onUpdateAttr: (conditionId: string, attrId: string, field: 'key' | 'type' | 'value' | 'operator', value: any, attrType: AttrType) => void;
    onRemoveAttr?: (conditionId: string, attrId: string, attrType: AttrType) => void;
    showDeleteButton?: boolean;
}) => {
    const operatorTypes = getOperatorsForType(operatorTypesMapping, attr.type);

    const handleValueChange = (newValue: string | boolean | number) => {
        onUpdateAttr(conditionId, attr.id, 'value', newValue, attrType);
    };

    return (
        <div className={`flex items-center group ${attr.hasError ? 'mb-8' : ''}`}>
            {/* Attribute Key Dropdown */}
            <div className="flex-[35] mr-3 min-w-0">
                <DropdownSelect
                    type={DropdownSelectType.SingleString}
                    title="Attributes"
                    items={attrKeys}
                    initialSelected={attr.key}
                    onChangeSelected={(selected) => {
                        onUpdateAttr(conditionId, attr.id, 'key', selected as string, attrType);
                    }}
                    buttonClassName="flex justify-between font-display border border-black w-full select-none"
                />
            </div>

            {/* Operator Dropdown */}
            <div className="flex-[15] mr-3">
                <DropdownSelect
                    type={DropdownSelectType.SingleString}
                    title="Condition"
                    items={operatorTypes}
                    initialSelected={attr.operator || operatorTypes[0] || 'eq'}
                    onChangeSelected={(selected) => {
                        onUpdateAttr(conditionId, attr.id, 'operator', selected as string, attrType);
                    }}
                    buttonClassName="flex justify-between font-display border border-black w-full select-none"
                />
            </div>

            {/* Value section */}
            <div className="flex-[35] mr-3">
                {attr.type === 'bool' ? (
                    <DropdownSelect
                        type={DropdownSelectType.SingleString}
                        title="Value"
                        items={['true', 'false']}
                        initialSelected={attr.value ? 'true' : 'false'}
                        onChangeSelected={(selected) => {
                            handleValueChange((selected as string) === 'true')
                        }}
                        buttonClassName="flex justify-between font-display border border-black w-full select-none"
                    />
                ) : (
                    <div className="relative">
                        <input
                            id="change-team-name-input"
                            type={attr.type === 'number' || attr.type === 'int64' || attr.type === 'float64' ? 'number' : 'text'}
                            placeholder={attr.hint ? attr.hint :`Enter ${getTypeDisplayName(attr.type)} value`}
                            value={attr.value as string | number}
                            onChange={(e) => {
                                const value = (attr.type === 'number' || attr.type === 'int64' || attr.type === 'float64') ?
                                    (e.target.value === '' ? '' : Number(e.target.value)) :
                                    e.target.value
                                handleValueChange(value)
                            }}
                            className={`w-full border rounded-md outline-hidden text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] py-2 px-4 font-body placeholder:text-neutral-400 ${attr.hasError ? 'border-red-500' : 'border-black'}`}
                        />
                        {attr.hasError && attr.errorMessage && (
                            <p className="absolute top-full left-0 w-full text-red-500 text-xs mt-1 ml-1">{attr.errorMessage}</p>
                        )}
                    </div>
                )}
            </div>

            {/* Remove Attribute Button */}
            <div className="flex justify-start flex-[15]">
                {showDeleteButton && onRemoveAttr ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveAttr(conditionId, attr.id, attrType)}
                        className="h-8 w-8 p-0 hover:bg-yellow-200 focus:bg-yellow-200 focus:opacity-100 flex-shrink-0
                       opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                ) : (
                    <div className="h-8 w-8"></div>
                )}
            </div>
        </div>
    )
};

export default RuleBuilderAttributeRow;