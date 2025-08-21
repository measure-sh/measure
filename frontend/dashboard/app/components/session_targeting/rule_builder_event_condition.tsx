"use client"

import DropdownSelect, { DropdownSelectType } from "../dropdown_select";
import RuleBuilderAttributeRow from "./rule_builder_attribute_row";
import RuleBuilderAddAttribute from "./rule_builder_add_attribute";
import ConditionContainer from "./rule_builder_condition_container";

interface RuleBuilderEventConditionProps {
    condition: any;
    eventTypes: string[];
    availableAttrs: any[];
    userDefinedAttrs: any[];
    operatorTypesMapping: any;
    canAddMoreAttrs: boolean;
    canAddMoreUdAttrs: boolean;
    supportsUdAttrs: boolean;
    onUpdateEventType: (conditionId: string, eventType: string) => void;
    onRemoveCondition: (conditionId: string) => void;
    onAddAttribute: (conditionId: string, type: 'attrs' | 'ud_attrs') => void;
    onUpdateAttr: (conditionId: string, attrId: string, field: 'key' | 'type' | 'value' | 'operator', value: any, attrType: 'attrs' | 'ud_attrs') => void;
    onRemoveAttr: (conditionId: string, attrId: string, attrType: 'attrs' | 'ud_attrs') => void;
    getOperatorsForType: (mapping: any, type: string) => string[];
}

const RuleBuilderEventCondition = ({
    condition,
    eventTypes,
    availableAttrs,
    userDefinedAttrs,
    operatorTypesMapping,
    canAddMoreAttrs,
    canAddMoreUdAttrs,
    supportsUdAttrs,
    onUpdateEventType,
    onRemoveCondition,
    onAddAttribute,
    onUpdateAttr,
    onRemoveAttr,
    getOperatorsForType
}: RuleBuilderEventConditionProps) => {
    return (
        <ConditionContainer
            conditionId={condition.id}
            onRemoveCondition={onRemoveCondition}
        >
            <div className="space-y-6">
                <div className="flex flex-row items-center">
                    <p className="text-sm">Event Type</p>
                    <div className="px-3" />
                    <DropdownSelect
                        type={DropdownSelectType.SingleString}
                        title="Select Event Type"
                        items={eventTypes}
                        initialSelected={condition.type || ""}
                        onChangeSelected={(selected) => {
                            onUpdateEventType(condition.id, selected as string)
                        }}
                    />
                </div>

                {availableAttrs.length > 0 && (
                    <div className="space-y-4">
                        <RuleBuilderAddAttribute
                            title="Attributes"
                            onAdd={() => onAddAttribute(condition.id, 'attrs')}
                            disabled={!canAddMoreAttrs}
                        />

                        {condition.attrs && condition.attrs.map((attr: any) => {
                            const attrKeys = availableAttrs.map(a => a.key);

                            return (
                                <RuleBuilderAttributeRow
                                    key={attr.id}
                                    attr={attr}
                                    conditionId={condition.id}
                                    attrType="attrs"
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

                {condition.type && supportsUdAttrs && userDefinedAttrs.length > 0 && (
                    <div className="space-y-4">
                        <RuleBuilderAddAttribute
                            title="User-defined Attributes"
                            onAdd={() => onAddAttribute(condition.id, 'ud_attrs')}
                            disabled={!canAddMoreUdAttrs}
                        />

                        {condition.ud_attrs && condition.ud_attrs.map((udAttr: any) => {
                            const attrKeys = userDefinedAttrs.map(a => a.key);

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

export default RuleBuilderEventCondition;