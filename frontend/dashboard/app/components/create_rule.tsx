"use client"

import { Plus, X } from 'lucide-react'
import React, { useState } from 'react'
import { Button } from './button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog"
import DropdownSelect, { DropdownSelectType } from './dropdown_select'

interface CreateRuleProps {
    onSuccess?: (rule: any) => void
}

interface Condition {
    id: string
    attribute: string
    operator: string
    value: string
}


const attributes = [
    'anr',
    'exception',
    'string',
    'gesture_long_click',
    'gesture_scroll',
    'gesture_click',
    'http',
    'network_change',
    'app_exit',
    'lifecycle_activity',
    'lifecycle_fragment',
    'lifecycle_view_controller',
    'lifecycle_swift_ui',
    'lifecycle_app',
    'cold_launch',
    'warm_launch',
    'hot_launch',
    'cpu_usage',
    'memory_usage',
    'memory_usage_absolute',
    'low_memory',
    'trim_memory',
    'navigation',
    'screen_view',
    'custom',
    'anr.foreground',
    'exception.foreground', 
    'exception.handled',
    'gesture_click.target',
    'gesture_click.target_id',
    'gesture_long_click.target',
    'gesture_long_click.target_id', 
    'gesture_scroll.target',
    'gesture_scroll.target_id',
    'http.url',
    'http.method',
    'http.status_code',
    'http.duration',
    'http.failure_reason',
    'http.failure_description',
    'app_exit.reason',
    'app_exit.trace',
    'lifecycle_activity.type',
    'lifecycle_activity.class_name',
    'lifecycle_fragment.type',
    'lifecycle_fragment.class_name',
    'lifecycle_view_controller.type',
    'lifecycle_view_controller.class_name',
    'lifecycle_swift_ui.type',
    'lifecycle_swift_ui.class_name',
    'lifecycle_app.type',
    'trim_memory.level',
    'screen_view.name',
    'custom.name',
    'platform',
    'user_id',
    'device_name',
    'device_model',
    'device_manufacturer',
    'device_type',
    'device_is_foldable',
    'device_is_physical',
    'device_density_dpi',
    'device_density',
    'device_locale',
    'os_name',
    'os_version',
    'os_page_size',
    'app_version',
    'app_build',
    'app_unique_id',
    'measure_sdk_version',
    'installation_id',
    'network_provider',
    'device_low_power_mode'
]

const operators = ['==', '!=', '<=', '>=', 'contains', 'startsWith']

const CreateRule: React.FC<CreateRuleProps> = ({ onSuccess }) => {
    const [dialogOpen, setDialogOpen] = useState(false)
    const [conditions, setConditions] = useState<Condition[]>([{
        id: '1',
        attribute: attributes[0],
        operator: operators[0],
        value: ''
    }])
    const [connector, setConnector] = useState<'AND' | 'OR'>('AND')

    const addCondition = () => {
        if (conditions.length < 5) {
            const newCondition: Condition = {
                id: (conditions.length + 1).toString(),
                attribute: attributes[0],
                operator: operators[0],
                value: ''
            }
            setConditions([...conditions, newCondition])
        }
    }

    const removeCondition = (conditionId: string) => {
        if (conditions.length > 1) {
            setConditions(conditions.filter(c => c.id !== conditionId))
        }
    }

    const updateCondition = (conditionId: string, field: keyof Condition, value: string) => {
        setConditions(conditions.map(c =>
            c.id === conditionId ? { ...c, [field]: value } : c
        ))
    }

    const generateCELExpression = (): string => {
        const conditionExpressions = conditions
            .filter(c => c.value.trim() !== '')
            .map(condition => {
                const { attribute, operator, value } = condition
                
                // Handle different operators
                switch (operator) {
                    case 'contains':
                        return `${attribute}.contains("${value}")`
                    case 'startsWith':
                        return `${attribute}.startsWith("${value}")`
                    default:
                        // For numeric values, don't quote
                        if (!isNaN(Number(value)) && value.trim() !== '') {
                            return `${attribute} ${operator} ${value}`
                        }
                        // For boolean values
                        if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
                            return `${attribute} ${operator} ${value.toLowerCase()}`
                        }
                        // For string values, quote them
                        return `${attribute} ${operator} "${value}"`
                }
            })

        if (conditionExpressions.length === 0) return ''
        if (conditionExpressions.length === 1) return conditionExpressions[0]
        
        return `(${conditionExpressions.join(` ${connector} `)})`
    }

    const handleSave = () => {
        const celExpression = generateCELExpression()
        if (celExpression) {
            onSuccess?.({
                expression: celExpression,
                enabled: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: 'user@example.com'
            })
            setDialogOpen(false)
            // Reset form
            setConditions([{
                id: '1',
                attribute: attributes[0],
                operator: operators[0],
                value: ''
            }])
            setConnector('AND')
        }
    }

    const canSave = () => {
        return conditions.some(condition => condition.value.trim() !== '')
    }

    return (
        <>
            <Button
                variant="outline"
                className="font-display border border-black"
                onClick={() => setDialogOpen(true)}
            >
                Create Rule
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
                    <DialogHeader>
                        <DialogTitle className="font-display">Create a rule to record sessions</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <tbody>
                                    {conditions.map((condition, index) => (
                                        <React.Fragment key={condition.id}>
                                            <tr>
                                                <td className="pr-1 pb-2" style={{ width: '200px' }}>
                                                    <DropdownSelect
                                                        title="Attribute"
                                                        type={DropdownSelectType.SingleString}
                                                        items={attributes}
                                                        initialSelected={condition.attribute}
                                                        onChangeSelected={(item) => updateCondition(condition.id, 'attribute', item as string)}
                                                    />
                                                </td>
                                                <td className="pr-3 pb-2" style={{ width: '80px' }}>
                                                    <DropdownSelect
                                                        title="Operator"
                                                        type={DropdownSelectType.SingleString}
                                                        items={operators}
                                                        initialSelected={condition.operator}
                                                        onChangeSelected={(item) => updateCondition(condition.id, 'operator', item as string)}
                                                    />
                                                </td>
                                                <td className="pr-3 pb-2" style={{ width: '150px' }}>
                                                    <input
                                                        type="text"
                                                        placeholder="Value"
                                                        className="w-full border border-black rounded-md outline-hidden focus-visible:outline-yellow-300 py-2 px-3 font-body placeholder:text-neutral-400"
                                                        value={condition.value}
                                                        onChange={(e) => updateCondition(condition.id, 'value', e.target.value)}
                                                    />
                                                </td>
                                                <td className="pb-2" style={{ width: '40px' }}>
                                                    {conditions.length > 1 && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => removeCondition(condition.id)}
                                                            className="h-8 w-8 p-0"
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                            {index < conditions.length - 1 && (
                                                <tr>
                                                    <td colSpan={4} className="text-center py-2">
                                                        <div className="flex justify-center gap-2">
                                                            <Button
                                                                variant={connector === 'AND' ? 'default' : 'outline'}
                                                                size="sm"
                                                                onClick={() => setConnector('AND')}
                                                                className="text-xs h-6 px-2"
                                                            >
                                                                AND
                                                            </Button>
                                                            <Button
                                                                variant={connector === 'OR' ? 'default' : 'outline'}
                                                                size="sm"
                                                                onClick={() => setConnector('OR')}
                                                                className="text-xs h-6 px-2"
                                                            >
                                                                OR
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        
                        {conditions.length < 5 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={addCondition}
                                className="w-full font-display border-dashed"
                            >
                                <Plus className="h-3 w-3 mr-1" />
                                Add Condition
                            </Button>
                        )}
                        
                        <div className="border-t pt-4">
                            <div className="space-y-2">
                                <label className="font-display text-sm font-semibold">CEL Expression Preview:</label>
                                <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                                    <code className="text-sm font-mono">
                                        {generateCELExpression() || 'Enter conditions to see expression preview'}
                                    </code>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex gap-2 pt-4">
                            <Button
                                variant="outline"
                                onClick={handleSave}
                                className="font-display border border-black"
                                disabled={!canSave()}
                            >
                                Save Rule
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setDialogOpen(false)}
                                className="font-display border border-black"
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}

export default CreateRule