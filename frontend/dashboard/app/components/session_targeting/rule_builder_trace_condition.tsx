"use client"

import DropdownSelect, { DropdownSelectType } from "../dropdown_select";
import RuleBuilderAttributeRow from "./rule_builder_attribute_row";
import RuleBuilderAddAttribute from "./rule_builder_add_attribute";
import ConditionContainer from "./rule_builder_condition_container";

interface RuleBuilderTraceConditionProps {
    condition: any;
    spanNames: string[];
    spanUdAttrs: any[];
    operatorTypesMapping: any;
    canAddMoreUdAttrs: boolean;
    onRemoveCondition: (conditionId: string) => void;
    onAddAttribute: (conditionId: string) => void;
    onUpdateSpanName: (conditionId: string, spanName: string) => void;
    onUpdateAttr: (conditionId: string, attrId: string, field: 'key' | 'type' | 'value' | 'operator', value: any, attrType: 'attrs' | 'ud_attrs') => void;
    onRemoveAttr: (conditionId: string, attrId: string, attrType: 'attrs' | 'ud_attrs') => void;
    getOperatorsForType: (mapping: any, type: string) => string[];
}

const SamplingTraceCondition = ({
    condition,
    spanNames,
    spanUdAttrs,
    operatorTypesMapping,
    canAddMoreUdAttrs,
    onRemoveCondition,
    onAddAttribute,
    onUpdateSpanName,
    onUpdateAttr,
    onRemoveAttr,
    getOperatorsForType
}: RuleBuilderTraceConditionProps) => {
    return (
        <ConditionContainer
            conditionId={condition.id}
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
                            onUpdateSpanName(condition.id, selected as string)
                        }}
                    />
                </div>

                {spanUdAttrs.length > 0 && (
                    <div className="space-y-4">
                        <RuleBuilderAddAttribute
                            title="User-defined Attributes"
                            onAdd={() => onAddAttribute(condition.id)}
                            disabled={!canAddMoreUdAttrs || !spanUdAttrs.length}
                        />

                        {condition.ud_attrs && condition.ud_attrs.map((udAttr: any) => {
                            const attrKeys = spanUdAttrs.map(a => a.key);

                            return (
                                <RuleBuilderAttributeRow
                                    key={udAttr.id}
                                    attr={udAttr}
                                    conditionId={condition.id}
                                    attrType="ud_attrs"
                                    attrKeys={attrKeys}
                                    operatorTypesMapping={operatorTypesMapping}
                                    getOperatorsForType={getOperatorsForType}
                                    onUpdateAttr={onUpdateAttr}
                                    onRemoveAttr={onRemoveAttr}
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