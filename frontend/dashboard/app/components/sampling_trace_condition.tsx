"use client"

import DropdownSelect, { DropdownSelectType } from "./dropdown_select";
import SamplingAttributeRow from "./sampling_attribute_row";
import AddAttribute from "./sampling_add_attribute";
import SamplingConditionContainer from "./sampling_condition_container";

interface SamplingTraceConditionProps {
    condition: any;
    index: number;
    spanNames: string[];
    spanUdAttrs: any[];
    operatorTypesMapping: any;
    canAddMoreUdAttrs: boolean;
    onRemoveCondition: (index: number) => void;
    onAddAttribute: (index: number) => void;
    onUpdateSpanName: (index: number, spanName: string) => void;
    onUpdateAttribute: (conditionIndex: number, attrIndex: number, field: 'key' | 'type' | 'value' | 'operator', value: any, attributeType: 'attrs' | 'udAttrs') => void;
    onRemoveAttribute: (conditionIndex: number, attrIndex: number, attributeType: 'attrs' | 'udAttrs') => void;
    getOperatorsForType: (mapping: any, type: string) => string[];
}

const SamplingTraceCondition = ({
    condition,
    index,
    spanNames,
    spanUdAttrs,
    operatorTypesMapping,
    canAddMoreUdAttrs,
    onRemoveCondition,
    onAddAttribute,
    onUpdateSpanName,
    onUpdateAttribute,
    onRemoveAttribute,
    getOperatorsForType
}: SamplingTraceConditionProps) => {
    return (
        <SamplingConditionContainer
            index={index}
            onRemoveCondition={onRemoveCondition}
        >
            <div className="space-y-6">
                <div className="flex flex-row items-center">
                    <p className="text-sm">Span Name</p>
                    <div className="px-3" />
                    <DropdownSelect
                        type={DropdownSelectType.SingleString}
                        title="Select Span Name"
                        items={spanNames}
                        initialSelected={condition.spanName || ""}
                        onChangeSelected={(selected) => {
                            onUpdateSpanName(index, selected as string)
                        }}
                    />
                </div>

                {spanUdAttrs.length > 0 && (
                    <div className="space-y-4">
                        <AddAttribute
                            title="User-defined Attributes"
                            onAdd={() => onAddAttribute(index)}
                            disabled={!canAddMoreUdAttrs || !spanUdAttrs.length}
                        />

                        {condition.udAttrs && condition.udAttrs.map((udAttr: any, udAttrIndex: number) => {
                            const operatorTypes = getOperatorsForType(operatorTypesMapping, udAttr.type)
                            const availableUdAttrKeys = spanUdAttrs.map(a => a.key);

                            return (
                                <SamplingAttributeRow
                                    key={`udAttrs-${index}-${udAttrIndex}`}
                                    attr={udAttr}
                                    attrIndex={udAttrIndex}
                                    conditionIndex={index}
                                    attributeType="udAttrs"
                                    availableAttrKeys={availableUdAttrKeys}
                                    operatorTypes={operatorTypes}
                                    onUpdateAttribute={onUpdateAttribute}
                                    onRemoveAttribute={onRemoveAttribute}
                                />
                            )
                        })}
                    </div>
                )}
            </div>
        </SamplingConditionContainer>
    );
};

export default SamplingTraceCondition;