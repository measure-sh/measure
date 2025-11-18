"use client"

import { AttributeField } from '@/app/utils/cel/conditions'
import { X } from 'lucide-react'
import { Button } from '../button'
import DropdownSelect, { DropdownSelectType } from '../dropdown_select'
import { useState, useEffect } from 'react'
import AttributeKeyDropdownSelect from './attribute_key_dropdown_select'
import AutocompleteInput from '../autocomplete_input'

interface AttributeBuilderProps {
    attribute: AttributeField
    attributeKeys: Record<string, string>
    operators: string[]
    onUpdateKey: (attrId: string, updatedKey: string, attrSource: string) => void
    onUpdateValue: (attrId: string, updateValue: string | number | boolean) => void
    onUpdateOperator: (attrId: string, operator: string) => void
    allowDelete: boolean
    onDelete?: (attrId: string) => void
    suggestions?: string[] | number[]
}

export default function AttributeBuilder({
    attribute,
    attributeKeys,
    operators,
    onUpdateValue,
    onUpdateOperator,
    allowDelete = true,
    onUpdateKey,
    onDelete,
    suggestions,
}: AttributeBuilderProps) {
    const [localValue, setLocalValue] = useState(attribute.value)

    useEffect(() => {
        setLocalValue(attribute.value)
    }, [attribute.value])


    const getTypeDisplayName = (type: string): string => {
        const typeMap: { [key: string]: string } = {
            float64: 'decimal',
            int64: 'number',
            number: 'number',
            string: 'text',
        }
        return typeMap[type] || type
    }

    const handleValueChange = (newValue: string) => {
        setLocalValue(newValue)
        
        let value: string | number | boolean;
        if (attribute.type === 'int64') {
            value = parseInt(newValue, 10) || 0
        } else if (attribute.type === 'number' || attribute.type === 'float64') {
            value = parseFloat(newValue) || 0
        } else {
            value = newValue
        }
        onUpdateValue(attribute.id, value)
    }

    return (
        <div className={`flex items-center group`}>
            <span className="mr-4">and</span>
            {/* Attribute Key Dropdown or Text */}
            <div className="flex-[35] mr-3 min-w-0">
                <AttributeKeyDropdownSelect
                    title="Attributes"
                    items={attributeKeys}
                    initialSelected={attribute.key}
                    onKeySelected={(key, attrSource) => {
                        onUpdateKey?.(attribute.id, key, attrSource)
                    }}
                    buttonClassName="flex justify-between font-display border border-black w-full select-none"
                />
            </div>

            {/* Operator Dropdown */}
            <div className="flex-[15] mr-3">
                <DropdownSelect
                    type={DropdownSelectType.SingleString}
                    title="Condition"
                    items={operators}
                    initialSelected={attribute.operator}
                    onChangeSelected={(selected) => {
                        onUpdateOperator(attribute.id, selected as string)
                    }}
                    buttonClassName="flex justify-between font-display border border-black w-full select-none"
                />
            </div>

            {/* Value section */}
            <div className="flex-[35] mr-3">
                {attribute.type === 'bool' ? (
                    <DropdownSelect
                        type={DropdownSelectType.SingleString}
                        title="Value"
                        items={['true', 'false']}
                        initialSelected={attribute.value ? 'true' : 'false'}
                        onChangeSelected={(selected) => {
                            onUpdateValue(attribute.id, (selected as string) === 'true')
                        }}
                        buttonClassName="flex justify-between font-display border border-black w-full select-none"
                    />
                ) : (
                    <AutocompleteInput
                        value={String(localValue ?? '')}
                        suggestions={suggestions?.map(String) ?? []}
                        placeholder={
                            attribute.hint
                                ? attribute.hint
                                : `Enter ${getTypeDisplayName(attribute.type)} value`
                        }
                        onValueChange={handleValueChange}
                    />
                )}
            </div>

            {/* Remove Attribute Button */}
            <div className="flex justify-start flex-[15]">
                {allowDelete && onDelete ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(attribute.id)}
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
}