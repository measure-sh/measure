"use client"

import DropdownSelect, { DropdownSelectType } from "./dropdown_select";
import SamplingAttributeRow from "./sampling_attribute_row";
import AddAttribute from "./sampling_add_attribute";
import SamplingConditionContainer from "./sampling_condition_container";

interface SamplingEventConditionProps {
    condition: any;
    index: number;
    eventTypes: string[];
    availableAttrs: any[];
    globalUserDefinedAttrs: any[];
    operatorTypesMapping: any;
    canAddMoreRegularAttrs: boolean;
    canAddMoreUdAttrs: boolean;
    doesEventSupportUdAttrs: (config: any, eventType: string) => boolean;
    pageConfig: any;
    onUpdateCondition: (index: number, eventType: string) => void;
    onRemoveCondition: (index: number) => void;
    onAddAttribute: (index: number, type: 'attrs' | 'udAttrs') => void;
    onUpdateAttribute: (conditionIndex: number, attrIndex: number, field: 'key' | 'type' | 'value' | 'operator', value: any, attributeType: 'attrs' | 'udAttrs') => void;
    onRemoveAttribute: (conditionIndex: number, attrIndex: number, attributeType: 'attrs' | 'udAttrs') => void;
    getOperatorsForType: (mapping: any, type: string) => string[];
}

const SamplingEventCondition = ({
    condition,
    index,
    eventTypes,
    availableAttrs,
    globalUserDefinedAttrs,
    operatorTypesMapping,
    canAddMoreRegularAttrs,
    canAddMoreUdAttrs,
    doesEventSupportUdAttrs,
    pageConfig,
    onUpdateCondition,
    onRemoveCondition,
    onAddAttribute,
    onUpdateAttribute,
    onRemoveAttribute,
    getOperatorsForType
}: SamplingEventConditionProps) => {
    return (
        <SamplingConditionContainer
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
                        <AddAttribute
                            title="Attributes"
                            onAdd={() => onAddAttribute(index, 'attrs')}
                            disabled={!canAddMoreRegularAttrs}
                        />

                        {condition.attrs && condition.attrs.map((attr: any, attrIndex: number) => {
                            const operatorTypes = getOperatorsForType(operatorTypesMapping, attr.type)
                            const availableAttrKeys = availableAttrs.map(a => a.key);

                            return (
                                <SamplingAttributeRow
                                    key={`attrs-${index}-${attrIndex}`}
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

                {condition.type && doesEventSupportUdAttrs(pageConfig, condition.type) && globalUserDefinedAttrs.length > 0 && (
                    <div className="space-y-4">
                        <AddAttribute
                            title="User-defined Attributes"
                            onAdd={() => onAddAttribute(index, 'udAttrs')}
                            disabled={!canAddMoreUdAttrs}
                        />

                        {condition.udAttrs && condition.udAttrs.map((udAttr: any, udAttrIndex: number) => {
                            const operatorTypes = getOperatorsForType(operatorTypesMapping, udAttr.type)
                            const availableUdAttrKeys = globalUserDefinedAttrs.map(a => a.key);

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

export default SamplingEventCondition;