"use client"

import RuleBuilderDropdownSelect from '@/app/components/rule_builder_dropdown_select';
import { Button } from '@/app/components/button';
import { X } from 'lucide-react';

type AttributeType = 'attrs' | 'ud_attrs';

const getUserFriendlyTypeName = (type: string): string => {
    const typeMap: { [key: string]: string } = {
        'float64': 'decimal',
        'int64': 'number',
        'number': 'number',
        'bool': 'true/false',
        'boolean': 'true/false',
        'string': 'text'
    };

    return typeMap[type] || type;
};

const RuleBuilderAttributeRow = ({
    attr,
    attrIndex,
    conditionIndex,
    attributeType,
    availableAttrKeys,
    operatorTypes,
    onUpdateAttribute,
    onRemoveAttribute,
    showDeleteButton = true
}: {
    attr: { id: string; key: string; type: string; value: string | boolean | number; operator?: string };
    attrIndex: number;
    conditionIndex: number;
    attributeType: AttributeType;
    availableAttrKeys: string[];
    operatorTypes: string[];
    onUpdateAttribute: (conditionIndex: number, attrIndex: number, field: 'key' | 'type' | 'value' | 'operator', value: any, attributeType: AttributeType) => void;
    onRemoveAttribute?: (conditionIndex: number, attributeId: string, attributeType: AttributeType) => void;
    showDeleteButton?: boolean;
}) => {

    return (
        <div className="flex items-center group">
            {/* Attribute Key Dropdown */}
            <div className="flex-[25] mr-3">
                <RuleBuilderDropdownSelect
                    title="Attributes"
                    items={availableAttrKeys}
                    initialSelected={attr.key}
                    onChangeSelected={(selected) => {
                        onUpdateAttribute(conditionIndex, attrIndex, 'key', selected, attributeType)
                    }}
                />
            </div>

            {/* Operator Dropdown */}
            <div className="flex-[15] mr-3">
                <RuleBuilderDropdownSelect
                    title="Condition"
                    items={operatorTypes}
                    initialSelected={attr.operator || operatorTypes[0] || 'eq'}
                    onChangeSelected={(selected) => {
                        onUpdateAttribute(conditionIndex, attrIndex, 'operator', selected, attributeType)
                    }}
                />
            </div>

            {/* Value section */}
            <div className="flex-[38] mr-3">
                {attr.type === 'bool' ? (
                    <RuleBuilderDropdownSelect
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
                        placeholder={`Enter ${getUserFriendlyTypeName(attr.type)} value`}
                        value={attr.value as string | number}
                        onChange={(e) => {
                            const value = (attr.type === 'number' || attr.type === 'int64' || attr.type === 'float64') ?
                                (e.target.value === '' ? '' : Number(e.target.value)) :
                                e.target.value
                            onUpdateAttribute(conditionIndex, attrIndex, 'value', value, attributeType)
                        }}
                        className="w-full border border-black rounded-md outline-hidden text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] py-2 px-4 font-body placeholder:text-neutral-400"
                    />
                )}
            </div>

            {/* Remove Attribute Button */}
            <div className="flex justify-start flex-[20]">
                {showDeleteButton && onRemoveAttribute ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveAttribute(conditionIndex, attr.id, attributeType)}
                        className="h-8 w-8 p-0 hover:bg-yellow-200 flex-shrink-0 
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