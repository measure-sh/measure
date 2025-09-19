"use client"

import DropdownSelect, { DropdownSelectType } from "../dropdown_select";
import RuleBuilderAttributeRow from "./rule_builder_attribute_row";
import RuleBuilderAddAttribute from "./rule_builder_add_attribute";
import ConditionContainer from "./rule_builder_condition_container";

interface RuleBuilderTraceConditionProps {
    condition: any;
    index: number;
    spanNames: string[];
    spanUdAttrs: any[];
    operatorTypesMapping: any;
    canAddMoreUdAttrs: boolean;
    onRemoveCondition: (conditionId: string) => void;
    onAddAttribute: (index: number) => void;
    onUpdateSpanName: (index: number, spanName: string) => void;
    onUpdateAttribute: (conditionIndex: number, attrIndex: number, field: 'key' | 'type' | 'value' | 'operator', value: any, attributeType: 'attrs' | 'ud_attrs') => void;
    onRemoveAttribute: (conditionIndex: number, attributeId: string, attributeType: 'attrs' | 'ud_attrs') => void;
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
}: RuleBuilderTraceConditionProps) => {
    return (
        <ConditionContainer
            conditionId={condition.id}
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
                        <RuleBuilderAddAttribute
                            title="User-defined Attributes"
                            onAdd={() => onAddAttribute(index)}
                            disabled={!canAddMoreUdAttrs || !spanUdAttrs.length}
                        />

                        {condition.ud_attrs && condition.ud_attrs.map((udAttr: any, udAttrIndex: number) => {
                            const operatorTypes = getOperatorsForType(operatorTypesMapping, udAttr.type)
                            const availableUdAttrKeys = spanUdAttrs.map(a => a.key);

                            return (
                                <RuleBuilderAttributeRow
                                    key={udAttr.id}
                                    attr={udAttr}
                                    attrIndex={udAttrIndex}
                                    conditionIndex={index}
                                    attributeType="ud_attrs"
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
        </ConditionContainer>
    );
};

export default SamplingTraceCondition;