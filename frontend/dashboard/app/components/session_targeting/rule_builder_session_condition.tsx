"use client"

import RuleBuilderAttributeRow from "./rule_builder_attribute_row";
import ConditionContainer from "./rule_builder_condition_container";

interface RuleBuilderSessionConditionProps {
    condition: any;
    index: number;
    sessionAttrs: any[];
    operatorTypesMapping: any;
    onRemoveCondition: (conditionId: string) => void;
    onUpdateAttribute: (conditionIndex: number, attrIndex: number, field: 'key' | 'type' | 'value' | 'operator', value: any, attributeType: 'attrs' | 'ud_attrs') => void;
    getOperatorsForType: (mapping: any, type: string) => string[];
}

const RuleBuilderSessionCondition = ({
    condition,
    index,
    sessionAttrs,
    operatorTypesMapping,
    onRemoveCondition,
    onUpdateAttribute,
    getOperatorsForType
}: RuleBuilderSessionConditionProps) => {
    return (
        <ConditionContainer
            conditionId={condition.id}
            index={index}
            onRemoveCondition={onRemoveCondition}
        >
            {sessionAttrs.length > 0 && condition.attrs && (
                <div className="space-y-4">
                    {condition.attrs.map((attr: any, attrIndex: number) => {
                        const operatorTypes = getOperatorsForType(operatorTypesMapping, attr.type)
                        const availableSessionAttrKeys = sessionAttrs.map(a => a.key);

                        return (
                            <RuleBuilderAttributeRow
                                key={attr.id}
                                attr={attr}
                                attrIndex={attrIndex}
                                conditionIndex={index}
                                attributeType="attrs"
                                availableAttrKeys={availableSessionAttrKeys}
                                operatorTypes={operatorTypes}
                                onUpdateAttribute={onUpdateAttribute}
                                showDeleteButton={false}
                            />
                        )
                    })}
                </div>
            )}
        </ConditionContainer>
    );
};

export default RuleBuilderSessionCondition;