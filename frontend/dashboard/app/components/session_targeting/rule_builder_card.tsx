"use client"

import { useState } from "react"
import { Card, CardContent, CardFooter } from "@/app/components/card"
import { Button } from "@/app/components/button"
import { Input } from "@/app/components/input"
import DropdownSelect, { DropdownSelectType } from "@/app/components/dropdown_select"
import { Plus } from "lucide-react"
import RuleBuilderAttributeRow from "@/app/components/session_targeting/rule_builder_attribute_row"

interface RuleBuilderCardProps {
    type: 'event' | 'trace' | 'session_attr'
    onCancel: () => void
    onSave: (rule: any) => void
    initialData?: any | null
}

interface EventFilter {
    id: string
    key: string
    type: string
    value: string | boolean | number
    operator: string
    hasError?: boolean
    errorMessage?: string
    hint?: string
}

// Sample data - replace with actual data from your API
const eventTypes = ["click", "view", "error", "custom"]
const attributeKeys = ["user_id", "session_id", "device_type", "app_version"]
const operators = ["equals", "not equals", "contains", "greater than", "less than"]

// Operator types mapping for different attribute types
const operatorTypesMapping = {
    string: ['eq', 'neq', 'contains', 'ncontains'],
    number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'],
    int64: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'],
    float64: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'],
    bool: ['eq', 'neq']
}

const getOperatorsForType = (mapping: any, type: string): string[] => {
    return mapping[type] || mapping.string
}

export default function RuleBuilderCard({ type, onCancel, onSave, initialData }: RuleBuilderCardProps) {
    const [selectedEventType, setSelectedEventType] = useState<string>(initialData?.eventType || eventTypes[0])
    const [eventFilters, setEventFilters] = useState<EventFilter[]>(initialData?.eventFilters || [])

    // For session_attr type
    const [sessionAttr, setSessionAttr] = useState<EventFilter>(initialData?.attribute || {
        id: 'session-attr',
        key: attributeKeys[0],
        type: 'string',
        operator: 'eq',
        value: ""
    })

    const [collectionMode, setCollectionMode] = useState<'none' | 'sample' | 'timeline'>(initialData?.collectionMode || 'sample')
    const [eventTraceSamplingRate, setEventTraceSamplingRate] = useState<string>(initialData?.eventTraceSamplingRate?.toString() || "100")
    const [snapshotType, setSnapshotType] = useState<'none' | 'screenshot' | 'layout'>(initialData?.snapshotType || 'none')

    const addEventFilter = () => {
        const newFilter: EventFilter = {
            id: `filter-${Date.now()}`,
            key: attributeKeys[0],
            type: 'string',
            operator: 'eq',
            value: ""
        }
        setEventFilters([...eventFilters, newFilter])
    }

    const removeEventFilter = (conditionId: string, attrId: string) => {
        setEventFilters(eventFilters.filter(filter => filter.id !== attrId))
    }

    const updateEventFilter = (conditionId: string, attrId: string, field: 'key' | 'type' | 'value' | 'operator', value: any) => {
        setEventFilters(eventFilters.map(filter =>
            filter.id === attrId ? { ...filter, [field]: value } : filter
        ))
    }

    const updateSessionAttr = (conditionId: string, attrId: string, field: 'key' | 'type' | 'value' | 'operator', value: any) => {
        setSessionAttr(prev => ({ ...prev, [field]: value }))
    }

    const handleSave = () => {
        let rule: any = {
            type: type,
            collectEvent: collectionMode === 'sample',
            collectTimeline: collectionMode === 'timeline',
            eventTraceSamplingRate: collectionMode === 'sample' ? parseFloat(eventTraceSamplingRate) : null,
            snapshotType: collectionMode === 'none' ? null : snapshotType
        }

        if (type === 'event' || type === 'trace') {
            rule.eventType = selectedEventType
            rule.eventFilters = eventFilters
        } else if (type === 'session_attr') {
            rule.attribute = sessionAttr
        }

        onSave(rule)
    }

    const checkboxStyle = "appearance-none border-black rounded-xs font-display checked:bg-neutral-950 checked:hover:bg-neutral-950 focus:ring-offset-yellow-200 focus:ring-0 checked:focus:bg-neutral-950"
    const radioStyle = "appearance-none border-black rounded-full font-display checked:bg-neutral-950 checked:hover:bg-neutral-950 focus:ring-offset-yellow-200 focus:ring-0 checked:focus:bg-neutral-950"

    return (
        <Card className="w-full">
            <CardContent className="pt-6">
                <div className="mb-6">
            </CardContent>

            <CardFooter className="flex justify-end gap-3">
                <Button
                    variant="outline"
                    onClick={onCancel}
                    className="font-display"
                >
                    Cancel
                </Button>
                <Button
                    variant="outline"
                    onClick={handleSave}
                    className="font-display border border-black"
                >
                    Create Filter
                </Button>
            </CardFooter>
        </Card>
    )
}
