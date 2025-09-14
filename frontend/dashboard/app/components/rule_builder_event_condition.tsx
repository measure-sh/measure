"use client"

import DropdownSelect, { DropdownSelectType } from "./dropdown_select";
import RuleBuilderAttributeRow from "./rule_builder_attribute_row";
import RuleBuilderAddAttribute from "./rule_builder_add_attribute";
import ConditionContainer from "./rule_builder_condition_container";

interface RuleBuilderEventConditionProps {
    condition: any;
    index: number;
    eventTypes: string[];
    availableAttrs: any[];
    userDefinedAttrs: any[];
    operatorTypesMapping: any;
    canAddMoreAttrs: boolean;
    canAddMoreUdAttrs: boolean;
    doesEventSupportUdAttrs: (config: any, eventType: string) => boolean;
    pageConfig: any;
    onUpdateCondition: (index: number, eventType: string) => void;
    onRemoveCondition: (conditionId: string) => void;
    onAddAttribute: (index: number, type: 'attrs' | 'ud_attrs') => void;
    onUpdateAttribute: (conditionIndex: number, attrIndex: number, field: 'key' | 'type' | 'value' | 'operator', value: any, attributeType: 'attrs' | 'ud_attrs') => void;
    onRemoveAttribute: (conditionIndex: number, attributeId: string, attributeType: 'attrs' | 'ud_attrs') => void;
    getOperatorsForType: (mapping: any, type: string) => string[];
}

const RuleBuilderEventCondition = ({
    condition,
    index,
    eventTypes,
    availableAttrs,
    userDefinedAttrs: userDefinedAttrs,
    operatorTypesMapping,
    canAddMoreAttrs: canAddMoreRegularAttrs,
    canAddMoreUdAttrs,
    doesEventSupportUdAttrs,
    pageConfig,
    onUpdateCondition,
    onRemoveCondition,
    onAddAttribute,
    onUpdateAttribute,
    onRemoveAttribute,
    getOperatorsForType
}: RuleBuilderEventConditionProps) => {
    return (
        <ConditionContainer
            conditionId={condition.id}
            index={index}
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
                            onUpdateCondition(index, selected as string)
                        }}
                    />
                </div>

                {availableAttrs.length > 0 && (
                    <div className="space-y-4">
                        <RuleBuilderAddAttribute
                            title="Attributes"
                            onAdd={() => onAddAttribute(index, 'attrs')}
                            disabled={!canAddMoreRegularAttrs}
                        />

                        {condition.attrs && condition.attrs.map((attr: any, attrIndex: number) => {
                            const operatorTypes = getOperatorsForType(operatorTypesMapping, attr.type)
                            const availableAttrKeys = availableAttrs.map(a => a.key);

                            return (
                                <RuleBuilderAttributeRow
                                    key={attr.id}
                                    attr={attr}
                                    attrIndex={attrIndex}
                                    conditionIndex={index}
                                    attributeType="attrs"
                                    availableAttrKeys={availableAttrKeys}
                                    operatorTypes={operatorTypes}
                                    onUpdateAttribute={onUpdateAttribute}
                                    onRemoveAttribute={onRemoveAttribute}
                                />
                            )
                        })}
                    </div>
                )}

                {condition.type && doesEventSupportUdAttrs(pageConfig, condition.type) && userDefinedAttrs.length > 0 && (
                    <div className="space-y-4">
                        <RuleBuilderAddAttribute
                            title="User-defined Attributes"
                            onAdd={() => onAddAttribute(index, 'ud_attrs')}
                            disabled={!canAddMoreUdAttrs}
                        />

                        {condition.ud_attrs && condition.ud_attrs.map((udAttr: any, udAttrIndex: number) => {
                            const operatorTypes = getOperatorsForType(operatorTypesMapping, udAttr.type)
                            const availableUdAttrKeys = userDefinedAttrs.map(a => a.key);

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

export default RuleBuilderEventCondition;