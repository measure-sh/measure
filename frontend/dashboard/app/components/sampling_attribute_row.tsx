"use client"

import DropdownSelect, { DropdownSelectType } from '@/app/components/dropdown_select';
import { Button } from '@/app/components/button';
import { Trash2 } from 'lucide-react';

type AttributeType = 'attrs' | 'udAttrs';

const SamplingAttributeRow = ({
    attr,
    attrIndex,
    conditionIndex,
    attributeType,
    availableAttrKeys,
    operatorTypes,
    onUpdateAttribute,
    onRemoveAttribute,
    showDeleteButton = true,
    predefinedValues
}: {
    attr: { key: string; type: string; value: string | boolean | number };
    attrIndex: number;
    conditionIndex: number;
    attributeType: AttributeType;
    availableAttrKeys: string[];
    operatorTypes: string[];
    onUpdateAttribute: (conditionIndex: number, attrIndex: number, field: 'key' | 'type' | 'value', value: any, attributeType: AttributeType) => void;
    onRemoveAttribute?: (conditionIndex: number, attrIndex: number, attributeType: AttributeType) => void;
    showDeleteButton?: boolean;
    predefinedValues?: string[]; // Add this new prop for generic predefined values
}) => {
    // Check if this attribute has predefined values
    const hasPredefinedValues = predefinedValues && predefinedValues.length > 0;

    return (
        <div className="flex items-center gap-3">
            {/* Attribute Key Dropdown */}
            <DropdownSelect
                type={DropdownSelectType.SingleString}
                title={"Attributes"}
                items={availableAttrKeys}
                initialSelected={attr.key}
                onChangeSelected={(selected) => {
                    onUpdateAttribute(conditionIndex, attrIndex, 'key', selected as string, attributeType)
                }}
            />

            {/* Operator Dropdown */}
            <DropdownSelect
                type={DropdownSelectType.SingleString}
                title="Condition"
                items={operatorTypes}
                initialSelected={operatorTypes[0] || 'eq'}
                onChangeSelected={(selected) => {
                    console.log(`Updated ${attributeType} operator: `, selected)
                }}
            />

            <div className="flex items-center gap-4 flex-1">
                {hasPredefinedValues ? (
                    <DropdownSelect
                        type={DropdownSelectType.SingleString}
                        title="Value"
                        items={predefinedValues}
                        initialSelected={String(attr.value) || predefinedValues[0]}
                        onChangeSelected={(selected) => {
                            // Convert to appropriate type based on attr type
                            let convertedValue: string | boolean | number = selected as string;
                            if (attr.type === 'bool') {
                                convertedValue = selected === 'true';
                            } else if (attr.type === 'number' || attr.type === 'int64' || attr.type === 'float64') {
                                convertedValue = Number(selected);
                            }
                            onUpdateAttribute(conditionIndex, attrIndex, 'value', convertedValue, attributeType)
                        }}
                    />
                ) : attr.type === 'bool' ? (
                    <DropdownSelect
                        type={DropdownSelectType.SingleString}
                        title="Value"
                        items={['true', 'false']}
                        initialSelected={attr.value ? 'true' : 'false'}
                        onChangeSelected={(selected) => {
                            onUpdateAttribute(conditionIndex, attrIndex, 'value', selected === 'true', attributeType)
                        }}
                    />
                ) : (
                    <input
                        id="change-team-name-input"
                        type={attr.type === 'number' || attr.type === 'int64' || attr.type === 'float64' ? 'number' : 'text'}
                        placeholder={`Enter ${attr.type} value`}
                        value={attr.value as string | number}
                        onChange={(e) => {
                            const value = (attr.type === 'number' || attr.type === 'int64' || attr.type === 'float64') ?
                                (e.target.value === '' ? '' : Number(e.target.value)) :
                                e.target.value
                            onUpdateAttribute(conditionIndex, attrIndex, 'value', value, attributeType)
                        }}
                        className="min-w-0 border border-black rounded-md outline-hidden text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] py-2 px-4 font-body placeholder:text-neutral-400"
                    />
                )}

                {/* Remove Attribute Button - Now directly adjacent to value input */}
                {showDeleteButton && onRemoveAttribute && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveAttribute(conditionIndex, attrIndex, attributeType)}
                        className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600 flex-shrink-0"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    )
};

export default SamplingAttributeRow;