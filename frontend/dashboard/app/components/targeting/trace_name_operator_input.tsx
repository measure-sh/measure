"use client"

import DropdownSelect, { DropdownSelectType } from "../dropdown_select"
import AutocompleteInput from "./../autocomplete_input"

interface TraceOperatorNameInputProps {
    operator: string
    value: string
    suggestions?: string[]
    availableOperators: string[]
    placeholder?: string
    onValueChange: (value: string) => void
    onOperatorChange: (operator: string) => void
}

export default function TraceOperatorNameInput({
    operator,
    value,
    suggestions = [],
    availableOperators,
    placeholder = "Enter trace name...",
    onValueChange,
    onOperatorChange
}: TraceOperatorNameInputProps) {
    return (
        <div className="flex items-center gap-2">
            <DropdownSelect
                type={DropdownSelectType.SingleString}
                title="Condition"
                items={availableOperators}
                initialSelected={operator}
                onChangeSelected={(selected) => {
                    onOperatorChange(selected as string)
                }}
                buttonClassName="flex justify-between font-display border border-black w-fit min-w-[120px] select-none"
            />

            <AutocompleteInput
                value={value}
                suggestions={suggestions}
                placeholder={placeholder}
                onValueChange={onValueChange}
            />
        </div>
    )
}