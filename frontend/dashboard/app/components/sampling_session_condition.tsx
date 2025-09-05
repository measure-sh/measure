"use client"

import SamplingAttributeRow from "./sampling_attribute_row";
import SamplingConditionContainer from "./sampling_condition_container";

interface SamplingSessionConditionProps {
    condition: any;
    index: number;
    sessionAttrs: any[];
    operatorTypesMapping: any;
    onRemoveCondition: (index: number) => void;
    onUpdateAttribute: (conditionIndex: number, attrIndex: number, field: 'key' | 'type' | 'value' | 'operator', value: any, attributeType: 'attrs' | 'udAttrs') => void;
    getOperatorsForType: (mapping: any, type: string) => string[];
}

const SamplingSessionCondition = ({
    condition,
    index,
    sessionAttrs,
    operatorTypesMapping,
    onRemoveCondition,
    onUpdateAttribute,
    getOperatorsForType
}: SamplingSessionConditionProps) => {
    return (
        <SamplingConditionContainer
            index={index}
            onRemoveCondition={onRemoveCondition}
        >
            {sessionAttrs.length > 0 && condition.attrs && (
                <div className="space-y-4">
                    {condition.attrs.map((attr: any, attrIndex: number) => {
                        const operatorTypes = getOperatorsForType(operatorTypesMapping, attr.type)
                        const availableSessionAttrKeys = sessionAttrs.map(a => a.key);

                        return (
                            <SamplingAttributeRow
                                key={`attrs-${index}-${attrIndex}`}
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
        </SamplingConditionContainer>
    );
};

export default SamplingSessionCondition;