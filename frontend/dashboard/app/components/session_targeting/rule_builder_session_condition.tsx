"use client"

import RuleBuilderAttributeRow from "./rule_builder_attribute_row";
import ConditionContainer from "./rule_builder_condition_container";

interface RuleBuilderSessionConditionProps {
    condition: any;
    sessionAttrs: any[];
    operatorTypesMapping: any;
    onRemoveCondition: (conditionId: string) => void;
    onUpdateAttr: (conditionId: string, attrId: string, field: 'key' | 'type' | 'value' | 'operator', value: any, attrType: 'attrs' | 'ud_attrs') => void;
    getOperatorsForType: (mapping: any, type: string) => string[];
}

const RuleBuilderSessionCondition = ({
    condition,
    sessionAttrs,
    operatorTypesMapping,
    onRemoveCondition,
    onUpdateAttr,
    getOperatorsForType
}: RuleBuilderSessionConditionProps) => {
    return (
        <ConditionContainer
            conditionId={condition.id}
            onRemoveCondition={onRemoveCondition}
        >
            {sessionAttrs.length > 0 && condition.attrs && (
                <div className="space-y-4">
                    {condition.attrs.map((attr: any) => {
                        const attrKeys = sessionAttrs.map(a => a.key);

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