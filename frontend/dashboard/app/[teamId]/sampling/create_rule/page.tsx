"use client"

import { Button } from '@/app/components/button'
import DropdownSelect, { DropdownSelectType } from '@/app/components/dropdown_select'
import { Input } from '@/app/components/input'
import TabSelect from '@/app/components/tab_select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/tooltip'
import { Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

// Constants
const MAX_CONDITIONS = 10

enum SamplingType {
  Session = "Session Sampling",
  Trace = "Trace Sampling"
}

interface BaseAttribute {
  type: 'string' | 'number' | 'boolean'
  cel: string
  placeholder?: string
}

interface StringAttribute extends BaseAttribute {
  type: 'string'
  placeholder?: string
}

interface NumberAttribute extends BaseAttribute {
  type: 'number'
  placeholder?: string
  min?: number
  max?: number
}

interface BooleanAttribute extends BaseAttribute {
  type: 'boolean'
}

// Event Configuration Types
interface EventOnlyConfig {
  type: 'event_only'
  label: string
  cel: string
}

interface HttpEventConfig {
  type: 'http'
  label: string
  cel: string
  attributes: {
    url: StringAttribute
    statusCode: NumberAttribute
  }
}

interface ClickEventConfig {
  type: 'click'
  label: string
  cel: string
  attributes: {
    targetId: StringAttribute
    targetClass: StringAttribute
  }
}

interface ScreenEventConfig {
  type: 'screen'
  label: string
  cel: string
  attributes: {
    screenName: StringAttribute
  }
}

interface UDAttribute {
  type: 'ud_attribute'
  cel: string
  maxItems: number
}


interface CustomEventConfig {
  type: 'custom'
  label: string
  cel: string
  attributes: {
    name: StringAttribute
    ud_attributes: UDAttribute
  }
}

type EventConfig = EventOnlyConfig | HttpEventConfig | ClickEventConfig | ScreenEventConfig | CustomEventConfig

// Session Attribute Types
interface StringSessionAttribute {
  key: string
  type: 'string'
  label: string
  cel: string
  options?: readonly string[]
}

interface BooleanSessionAttribute {
  key: string
  type: 'boolean'
  label: string
  cel: string
}

type SessionAttribute = StringSessionAttribute | BooleanSessionAttribute

// Strong Configuration Interface
interface Events {
  'ANR': EventOnlyConfig
  'Crash': EventOnlyConfig
  'Bug report': EventOnlyConfig
  'Custom event': CustomEventConfig
  'Http': HttpEventConfig
  'Click': ClickEventConfig
  'Activity viewed': ScreenEventConfig
  'Fragment viewed': ScreenEventConfig
  'Screen viewed': ScreenEventConfig
}

interface SessionAttributes {
  'user_id': StringSessionAttribute
  'device_name': StringSessionAttribute
  'device_model': StringSessionAttribute
  'device_manufacturer': StringSessionAttribute
  'device_type': StringSessionAttribute
  'device_is_foldable': BooleanSessionAttribute
  'device_is_physical': BooleanSessionAttribute
  'device_locale': StringSessionAttribute
  'os_version': StringSessionAttribute
  'app_version': StringSessionAttribute
  'measure_sdk_version': StringSessionAttribute
  'installation_id': StringSessionAttribute
  'low_power_mode': BooleanSessionAttribute
  'thermal_throttling': BooleanSessionAttribute
}

interface SamplingConfig {
  events: Events
  sessionAttributes: SessionAttributes
  operatorMappings: {
    readonly 'equals': '=='
    readonly 'contains': '.contains'
    readonly 'startsWith': '.startsWith'
    readonly 'endsWith': '.endsWith'
    readonly '>': ' > '
    readonly '<': ' < '
    readonly '>=': ' >= '
    readonly '<=': ' <= '
    readonly '==': ' == '
  }
  operatorsByType: {
    readonly 'string': readonly ['contains', 'startsWith', 'endsWith', 'equals']
    readonly 'number': readonly ['>', '<', '>=', '<=', '==']
    readonly 'boolean': readonly []
  }
  attributeTypes: readonly ['string', 'boolean', 'number']
}

// Strongly Typed Sampling Configuration
const SAMPLING_CONFIG: SamplingConfig = {
  events: {
    'ANR': {
      type: 'event_only',
      label: 'ANR',
      cel: 'event_type == "anr"'
    },
    'Crash': {
      type: 'event_only',
      label: 'Crash', 
      cel: 'event_type == "exception" && exception.handled == false'
    },
    'Bug report': {
      type: 'event_only',
      label: 'Bug report',
      cel: 'event_type == "bug_report"'
    },
    'Custom event': {
      type: 'custom',
      label: 'Custom event',
      cel: 'event_type == "custom"',
      attributes: {
        name: {
          type: 'string',
          cel: 'custom.name'
        },
        ud_attributes: {
          type: 'ud_attribute',
          cel: 'custom.user_defined_attribute',
          maxItems: MAX_CONDITIONS
        }
      }
    },
    'Http': {
      type: 'http',
      label: 'Http',
      cel: 'event_type == "http"',
      attributes: {
        url: {
          type: 'string',
          cel: 'http.url',
          placeholder: 'URL'
        },
        statusCode: {
          type: 'number',
          cel: 'http.status_code',
          placeholder: 'Status code (optional, e.g., 200, 404)',
          min: 100,
          max: 599
        }
      }
    },
    'Click': {
      type: 'click',
      label: 'Click',
      cel: 'event_type == "gesture_click"',
      attributes: {
        targetId: {
          type: 'string',
          cel: 'target_id',
          placeholder: 'Target ID (e.g. btn_help, btn_login)'
        },
        targetClass: {
          type: 'string',
          cel: 'target',
          placeholder: 'Target class (e.g. MaterialButton, TextView)'
        }
      }
    },
    'Activity viewed': {
      type: 'screen',
      label: 'Activity viewed',
      cel: 'event_type == "lifecycle_activity"',
      attributes: {
        screenName: {
          type: 'string',
          cel: 'class_name',
          placeholder: 'Screen name'
        }
      }
    },
    'Fragment viewed': {
      type: 'screen',
      label: 'Fragment viewed',
      cel: 'event_type == "lifecycle_fragment"',
      attributes: {
        screenName: {
          type: 'string',
          cel: 'class_name',
          placeholder: 'Screen name'
        }
      }
    },
    'Screen viewed': {
      type: 'screen',
      label: 'Screen viewed',
      cel: 'event_type == "screen_view"',
      attributes: {
        screenName: {
          type: 'string',
          cel: 'screen_view.name',
          placeholder: 'Screen name'
        }
      }
    }
  },
  sessionAttributes: {
    'user_id': {
      key: 'user_id',
      type: 'string',
      label: 'User ID',
      cel: 'attribute.user_id'
    },
    'device_name': {
      key: 'device_name',
      type: 'string',
      label: 'Device name',
      cel: 'attribute.device_name'
    },
    'device_model': {
      key: 'device_model',
      type: 'string',
      label: 'Device model',
      cel: 'attribute.device_model'
    },
    'device_manufacturer': {
      key: 'device_manufacturer',
      type: 'string',
      label: 'Device manufacturer',
      cel: 'attribute.device_manufacturer'
    },
    'device_type': {
      key: 'device_type',
      type: 'string',
      label: 'Device type',
      cel: 'attribute.device_type',
      options: ['phone', 'tablet'] as const
    },
    'device_is_foldable': {
      key: 'device_is_foldable',
      type: 'boolean',
      label: 'Device is foldable',
      cel: 'attribute.device_is_foldable'
    },
    'device_is_physical': {
      key: 'device_is_physical',
      type: 'boolean',
      label: 'Device is physical',
      cel: 'attribute.device_is_physical'
    },
    'device_locale': {
      key: 'device_locale',
      type: 'string',
      label: 'Device locale',
      cel: 'attribute.device_locale'
    },
    'os_version': {
      key: 'os_version',
      type: 'string',
      label: 'OS version',
      cel: 'attribute.os_version'
    },
    'app_version': {
      key: 'app_version',
      type: 'string',
      label: 'App version',
      cel: 'attribute.app_version'
    },
    'measure_sdk_version': {
      key: 'measure_sdk_version',
      type: 'string',
      label: 'Measure SDK version',
      cel: 'attribute.measure_sdk_version'
    },
    'installation_id': {
      key: 'installation_id',
      type: 'string',
      label: 'Installation ID',
      cel: 'attribute.installation_id'
    },
    'low_power_mode': {
      key: 'low_power_mode',
      type: 'boolean',
      label: 'Low power mode',
      cel: 'attribute.low_power_mode'
    },
    'thermal_throttling': {
      key: 'thermal_throttling',
      type: 'boolean',
      label: 'Thermal throttling',
      cel: 'attribute.thermal_throttling'
    }
  },
  operatorMappings: {
    'equals': '==',
    'contains': '.contains',
    'startsWith': '.startsWith',
    'endsWith': '.endsWith',
    '>': ' > ',
    '<': ' < ',
    '>=': ' >= ',
    '<=': ' <= ',
    '==': ' == '
  },
  operatorsByType: {
    'string': ['contains', 'startsWith', 'endsWith', 'equals'] as const,
    'number': ['>', '<', '>=', '<=', '=='] as const,
    'boolean': [] as const
  },
  attributeTypes: ['string', 'boolean', 'number'] as const
}

// Event access helpers
type EventName = keyof Events
type SessionAttributeKey = keyof SessionAttributes
type OperatorType = keyof typeof SAMPLING_CONFIG.operatorMappings

const getEventNames = (): EventName[] => Object.keys(SAMPLING_CONFIG.events) as EventName[]

function getEventConfig<K extends EventName>(eventName: K): Events[K]
function getEventConfig(eventName: string): EventConfig | undefined
function getEventConfig(eventName: string) {
  return SAMPLING_CONFIG.events[eventName as EventName]
}

// Session attribute access helpers  
const getSessionAttributeLabels = (): string[] => 
  Object.values(SAMPLING_CONFIG.sessionAttributes).map(attr => attr.label)

function getSessionAttribute<K extends SessionAttributeKey>(key: K): SessionAttributes[K]
function getSessionAttribute(key: string): SessionAttribute | undefined
function getSessionAttribute(key: string) {
  return SAMPLING_CONFIG.sessionAttributes[key as SessionAttributeKey]
}

const getSessionAttributeByLabel = (label: string): SessionAttribute | undefined =>
  Object.values(SAMPLING_CONFIG.sessionAttributes).find(attr => attr.label === label)

// Validation helpers
const isValidSamplingRate = (rate: string): boolean => {
  const num = parseFloat(rate)
  return !isNaN(num) && num >= 0 && num <= 100
}

// Type-safe attributes access helpers (no more runtime checks!)
const getHttpAttributes = () => SAMPLING_CONFIG.events['Http'].attributes
const getClickAttributes = () => SAMPLING_CONFIG.events['Click'].attributes

function getScreenField(eventName: 'Activity viewed'): typeof SAMPLING_CONFIG.events['Activity viewed']['attributes']['screenName']
function getScreenField(eventName: 'Fragment viewed'): typeof SAMPLING_CONFIG.events['Fragment viewed']['attributes']['screenName']  
function getScreenField(eventName: 'Screen viewed'): typeof SAMPLING_CONFIG.events['Screen viewed']['attributes']['screenName']
function getScreenField(eventName: string): StringAttribute | undefined
function getScreenField(eventName: string) {
  const config = getEventConfig(eventName)
  if (config && 'attributes' in config && 'screenName' in config.attributes) {
    return config.attributes.screenName
  }
  return undefined
}

// Type-safe operator access - derived from type
function getOperatorsForType(type: 'string'): readonly ['contains', 'startsWith', 'endsWith', 'equals']
function getOperatorsForType(type: 'number'): readonly ['>', '<', '>=', '<=', '==']
function getOperatorsForType(type: 'boolean'): readonly []
function getOperatorsForType(type: string): readonly string[]
function getOperatorsForType(type: string) {
  return SAMPLING_CONFIG.operatorsByType[type as keyof typeof SAMPLING_CONFIG.operatorsByType] || [] as const
}

function getDefaultOperatorForType(type: 'string'): 'contains'
function getDefaultOperatorForType(type: 'number'): '>'  
function getDefaultOperatorForType(type: 'boolean'): '=='
function getDefaultOperatorForType(type: string): string
function getDefaultOperatorForType(type: string) {
  const operators = getOperatorsForType(type)
  if (type === 'boolean') return '=='
  return operators.length > 0 ? operators[0] || '' : ''
}

// Helper to get operators for a attribute
function getOperatorsForField(attribute: StringAttribute | NumberAttribute | BooleanAttribute): readonly string[] {
  return getOperatorsForType(attribute.type)
}

// Helper to get default operator for a attribute
function getDefaultOperatorForField(attribute: StringAttribute | NumberAttribute | BooleanAttribute): string {
  return getDefaultOperatorForType(attribute.type)
}

// Types
interface AttributeWithOperator {
  value: string
  operator: string
}

interface UDEventAttribute {
  key: string
  type: string
  condition: string
  value: string
}

interface EventCondition {
  event: string
  logicalOperator?: 'AND' | 'OR'
  // Custom event fields
  customEventName?: string
  ud_event_attributes?: UDEventAttribute[]
  // HTTP fields
  httpUrl?: AttributeWithOperator
  httpStatusCode?: AttributeWithOperator
  // Screen fields
  screenField?: AttributeWithOperator
  // Click fields
  targetId?: AttributeWithOperator
  targetClass?: AttributeWithOperator
}

interface SessionCondition {
  attribute: string
  operator: string
  value: string
  logicalOperator?: 'AND' | 'OR'
}


// Reusable Components
interface LogicalOperatorButtonProps {
  index: number
  operator?: 'AND' | 'OR'
  onToggle: () => void
}

function LogicalOperatorButton({ index, operator, onToggle }: LogicalOperatorButtonProps) {
  if (index === 0) return null
  
  return (
    <button
      onClick={onToggle}
      className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
    >
      {operator || 'AND'}
    </button>
  )
}

interface AttributeWithOperatorProps {
  label: string
  operatorValue: string
  operatorOptions: readonly string[]
  onOperatorChange: (value: string) => void
  children: React.ReactNode
}

function AttributeWithOperator({ label, operatorValue, operatorOptions, onOperatorChange, children }: AttributeWithOperatorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground whitespace-nowrap">{label}</span>
      <div className="w-20">
        <select
          value={operatorValue}
          onChange={(e) => onOperatorChange(e.target.value)}
          className="w-full p-2 border rounded text-sm"
        >
          {operatorOptions.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>
      <div className="flex-1">
        {children}
      </div>
    </div>
  )
}

interface ValueInputProps {
  type: 'string' | 'boolean' | 'number'
  value: string
  onChange: (value: string) => void
  placeholder?: string
  options?: readonly string[]
  min?: string
  max?: string
}

function ValueInput({ type, value, onChange, placeholder, options, min, max }: ValueInputProps) {
  if (type === 'boolean') {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-2 border rounded text-sm"
      >
        <option value="">Select value</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    )
  }

  if (options) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-2 border rounded text-sm"
      >
        <option value="">Select value</option>
        {options.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    )
  }

  return (
    <Input
      type={type === 'number' ? 'number' : 'text'}
      placeholder={placeholder || 'Value'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full"
      min={min}
      max={max}
    />
  )
}

// Session Condition Row Component
interface SessionConditionRowProps {
  condition: SessionCondition
  index: number
  onUpdate: (index: number, condition: keyof SessionCondition, value: string) => void
  onRemove: (index: number) => void
}

function SessionConditionRow({ condition, index, onUpdate, onRemove }: SessionConditionRowProps) {
  const selectedAttribute = getSessionAttribute(condition.attribute)
  const availableOperators = selectedAttribute ? getOperatorsForField(selectedAttribute) : []

  const handleLogicalOperatorToggle = () => {
    onUpdate(index, 'logicalOperator', condition.logicalOperator === 'AND' ? 'OR' : 'AND')
  }

  const handleAttributeChange = (attributeKey: string) => {
    const newAttribute = getSessionAttribute(attributeKey)
    const defaultOperator = newAttribute ? getDefaultOperatorForField(newAttribute) : ''
    onUpdate(index, 'attribute', attributeKey)
    onUpdate(index, 'operator', defaultOperator)
    onUpdate(index, 'value', '')
  }

  return (
    <div className="border-b last:border-b-0">
      <div className="p-4 flex items-center gap-3">
        <LogicalOperatorButton
          index={index}
          operator={condition.logicalOperator}
          onToggle={handleLogicalOperatorToggle}
        />
        
        <div className="flex items-center gap-2 flex-1">
          <div className="flex-1">
            <DropdownSelect
              title="Select attribute..."
              type={DropdownSelectType.SingleString}
              items={getSessionAttributeLabels()}
              initialSelected={condition.attribute ? getSessionAttribute(condition.attribute)?.label || '' : ''}
              onChangeSelected={(item) => {
                const selectedAttr = getSessionAttributeByLabel(item as string)
                if (selectedAttr) {
                  handleAttributeChange(selectedAttr.key)
                }
              }}
            />
          </div>

          {selectedAttribute && selectedAttribute.type !== 'boolean' && (
            <select
              value={condition.operator}
              onChange={(e) => onUpdate(index, 'operator', e.target.value)}
              className="w-20 p-2 border rounded text-sm"
              disabled={!condition.attribute}
            >
              <option value="">Op</option>
              {availableOperators.map(op => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          )}

          <ValueInput
            type={selectedAttribute?.type || 'string'}
            value={condition.value}
            onChange={(value) => onUpdate(index, 'value', value)}
            options={selectedAttribute && 'options' in selectedAttribute ? selectedAttribute.options : undefined}
          />
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(index)}
          className="p-1 h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// Custom Event Attribute Row Component
interface UDEventAttributeRowProps {
  attribute: UDEventAttribute
  index: number
  onUpdate: (index: number, attribute: keyof UDEventAttribute, value: string) => void
  onTypeChange: (index: number, newType: string) => void
  onRemove: (index: number) => void
}

function UDEventAttributeRow({ attribute, index, onUpdate, onTypeChange, onRemove }: UDEventAttributeRowProps) {
  const availableOperators = getOperatorsForType(attribute.type)

  return (
    <div className="flex items-center gap-2">
      <Input
        type="text"
        placeholder="Key"
        value={attribute.key}
        onChange={(e) => onUpdate(index, 'key', e.target.value)}
        className="flex-1"
      />
      <div className="flex-1">
        <select
          value={attribute.type}
          onChange={(e) => onTypeChange(index, e.target.value)}
          className="w-full p-2 border rounded text-sm"
        >
          <option value="">Type</option>
          {SAMPLING_CONFIG.attributeTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>
      {attribute.type !== 'boolean' && (
        <div className="flex-1">
          <select
            value={attribute.condition}
            onChange={(e) => onUpdate(index, 'condition', e.target.value)}
            className="w-full p-2 border rounded text-sm"
            disabled={!attribute.type}
          >
            <option value="">Condition</option>
            {availableOperators.map(condition => (
              <option key={condition} value={condition}>{condition}</option>
            ))}
          </select>
        </div>
      )}
      <div className="flex-1">
        <ValueInput
          type={attribute.type as 'string' | 'boolean' | 'number'}
          value={attribute.value}
          onChange={(value) => onUpdate(index, 'value', value)}
        />
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRemove(index)}
        className="p-1 h-8 w-8"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}

// Generic Event Fields Component
function EventFields({ condition, onUpdate }: { condition: EventCondition, onUpdate: (updates: Partial<EventCondition>) => void }) {
  const eventConfig = getEventConfig(condition.event)

  if (!eventConfig || eventConfig.type === 'event_only') {
    return null
  }

  return (
    <div className="space-y-3 mt-3">
      {eventConfig.type === 'custom' && <CustomEventAttributes condition={condition} onUpdate={onUpdate} />}
      {eventConfig.type === 'http' && <HttpEventAttributes condition={condition} onUpdate={onUpdate} />}
      {eventConfig.type === 'screen' && <ScreenEventAttributes condition={condition} onUpdate={onUpdate} />}
      {eventConfig.type === 'click' && <ClickEventAttributes condition={condition} onUpdate={onUpdate} />}
    </div>
  )
}

// Custom Event Fields Component
function CustomEventAttributes({ condition, onUpdate }: { condition: EventCondition, onUpdate: (updates: Partial<EventCondition>) => void }) {
  const attributes = condition.ud_event_attributes || []
  
  const addAttribute = () => {
    if (attributes.length < MAX_CONDITIONS) {
      onUpdate({ 
        ud_event_attributes: [...attributes, { key: '', type: '', condition: '', value: '' }]
      })
    }
  }

  const updateAttribute = (index: number, attribute: keyof UDEventAttribute, value: string) => {
    const newAttributes = [...attributes]
    newAttributes[index] = { ...newAttributes[index], [attribute]: value }
    onUpdate({ ud_event_attributes: newAttributes })
  }

  const updateAttributeType = (index: number, newType: string) => {
    const defaultCondition = getDefaultOperatorForType(newType)
    const newAttributes = [...attributes]
    newAttributes[index] = { 
      ...newAttributes[index], 
      type: newType, 
      condition: defaultCondition, 
      value: '' 
    }
    onUpdate({ ud_event_attributes: newAttributes })
  }

  const removeAttribute = (index: number) => {
    onUpdate({ ud_event_attributes: attributes.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-3 mt-3">
      <Input
        type="text"
        placeholder="Custom event name"
        value={condition.customEventName || ''}
        onChange={(e) => onUpdate({ customEventName: e.target.value })}
        className="w-full"
      />

      <div className="space-y-2">
        {attributes.map((attr, index) => (
          <UDEventAttributeRow
            key={index}
            attribute={attr}
            index={index}
            onUpdate={updateAttribute}
            onTypeChange={updateAttributeType}
            onRemove={removeAttribute}
          />
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={addAttribute}
          disabled={attributes.length >= MAX_CONDITIONS}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add attribute
        </Button>
      </div>
    </div>
  )
}

// HTTP Event Fields Component
function HttpEventAttributes({ condition, onUpdate }: { condition: EventCondition, onUpdate: (updates: Partial<EventCondition>) => void }) {
  const { url: urlField, statusCode: statusCodeField } = getHttpAttributes()

  const updateAttribute = (attributeName: 'httpUrl' | 'httpStatusCode', attribute: keyof AttributeWithOperator, value: string) => {
    const defaultOperator = attributeName === 'httpUrl' ? getDefaultOperatorForField(urlField) : getDefaultOperatorForField(statusCodeField)
    const currentAttribute = condition[attributeName] || { value: '', operator: defaultOperator }
    onUpdate({ [attributeName]: { ...currentAttribute, [attribute]: value } })
  }

  return (
    <div className="space-y-3">
      <AttributeWithOperator
        label="URL"
        operatorValue={condition.httpUrl?.operator || getDefaultOperatorForField(urlField)}
        operatorOptions={getOperatorsForField(urlField)}
        onOperatorChange={(value) => updateAttribute('httpUrl', 'operator', value)}
      >
        <Input
          type="text"
          placeholder={urlField.placeholder}
          value={condition.httpUrl?.value || ''}
          onChange={(e) => updateAttribute('httpUrl', 'value', e.target.value)}
          className="w-full"
        />
      </AttributeWithOperator>

      <AttributeWithOperator
        label="Status code"
        operatorValue={condition.httpStatusCode?.operator || getDefaultOperatorForField(statusCodeField)}
        operatorOptions={getOperatorsForField(statusCodeField)}
        onOperatorChange={(value) => updateAttribute('httpStatusCode', 'operator', value)}
      >
        <input
          type="number"
          placeholder={statusCodeField.placeholder}
          value={condition.httpStatusCode?.value || ''}
          onChange={(e) => updateAttribute('httpStatusCode', 'value', e.target.value)}
          className="w-full p-2 border rounded text-sm"
          min={statusCodeField.min}
          max={statusCodeField.max}
        />
      </AttributeWithOperator>
    </div>
  )
}

// Screen Event Fields Component
function ScreenEventAttributes({ condition, onUpdate }: { condition: EventCondition, onUpdate: (updates: Partial<EventCondition>) => void }) {
  const screenField = getScreenField(condition.event)

  const updateScreenField = (attribute: keyof AttributeWithOperator, value: string) => {
    const defaultOperator = screenField ? getDefaultOperatorForField(screenField) : 'equals'
    const currentField = condition.screenField || { value: '', operator: defaultOperator }
    onUpdate({ screenField: { ...currentField, [attribute]: value } })
  }

  if (!screenField) return null

  return (
    <AttributeWithOperator
      label="Screen name"
      operatorValue={condition.screenField?.operator || getDefaultOperatorForField(screenField)}
      operatorOptions={getOperatorsForField(screenField)}
      onOperatorChange={(value) => updateScreenField('operator', value)}
    >
      <input
        type="text"
        placeholder={screenField.placeholder}
        value={condition.screenField?.value || ''}
        onChange={(e) => updateScreenField('value', e.target.value)}
        className="w-full p-2 border rounded text-sm"
      />
    </AttributeWithOperator>
  )
}

// Click Event Fields Component
function ClickEventAttributes({ condition, onUpdate }: { condition: EventCondition, onUpdate: (updates: Partial<EventCondition>) => void }) {
  const { targetId: targetIdField, targetClass: targetClassField } = getClickAttributes()

  const updateField = (fieldName: 'targetId' | 'targetClass', attribute: keyof AttributeWithOperator, value: string) => {
    const defaultOperator = fieldName === 'targetId' ? getDefaultOperatorForField(targetIdField) : getDefaultOperatorForField(targetClassField)
    const currentField = condition[fieldName] || { value: '', operator: defaultOperator }
    onUpdate({ [fieldName]: { ...currentField, [attribute]: value } })
  }

  return (
    <div className="space-y-3">
      <AttributeWithOperator
        label="Target ID"
        operatorValue={condition.targetId?.operator || getDefaultOperatorForField(targetIdField)}
        operatorOptions={getOperatorsForField(targetIdField)}
        onOperatorChange={(value) => updateField('targetId', 'operator', value)}
      >
        <input
          type="text"
          placeholder={targetIdField.placeholder}
          value={condition.targetId?.value || ''}
          onChange={(e) => updateField('targetId', 'value', e.target.value)}
          className="w-full p-2 border rounded text-sm"
        />
      </AttributeWithOperator>

      <AttributeWithOperator
        label="Target class"
        operatorValue={condition.targetClass?.operator || getDefaultOperatorForField(targetClassField)}
        operatorOptions={getOperatorsForField(targetClassField)}
        onOperatorChange={(value) => updateField('targetClass', 'operator', value)}
      >
        <input
          type="text"
          placeholder={targetClassField.placeholder}
          value={condition.targetClass?.value || ''}
          onChange={(e) => updateField('targetClass', 'value', e.target.value)}
          className="w-full p-2 border rounded text-sm"
        />
      </AttributeWithOperator>
    </div>
  )
}

// Event Condition Row Component
interface EventConditionRowProps {
  condition: EventCondition
  index: number
  items: string[]
  onConditionChange: (index: number, value: EventCondition) => void
  onRemove: (index: number) => void
  autoFocus?: boolean
}

function EventConditionRow({ condition, index, onConditionChange, onRemove, autoFocus }: EventConditionRowProps) {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const hasTriggeredAutoFocus = useRef(false)

  const updateCondition = (updates: Partial<EventCondition>) => {
    onConditionChange(index, { ...condition, ...updates })
  }

  const handleEventChange = (eventName: string) => {
    const eventConfig = getEventConfig(eventName)
    let updates: Partial<EventCondition> = { event: eventName }

    // Set default attribute values based on event config
    if (eventConfig?.type === 'http') {
      const { url: urlAttribute, statusCode: statusCodeAttribute } = getHttpAttributes()
      updates.httpUrl = { value: '', operator: getDefaultOperatorForField(urlAttribute) }
      updates.httpStatusCode = { value: '', operator: getDefaultOperatorForField(statusCodeAttribute) }
    } else if (eventConfig?.type === 'click') {
      const { targetId: targetIdField, targetClass: targetClassField } = getClickAttributes()
      updates.targetId = { value: '', operator: getDefaultOperatorForField(targetIdField) }
      updates.targetClass = { value: '', operator: getDefaultOperatorForField(targetClassField) }
    } else if (eventConfig?.type === 'screen') {
      const screenField = getScreenField(eventName)
      if (screenField) {
        updates.screenField = { value: '', operator: getDefaultOperatorForField(screenField) }
      }
    }

    updateCondition(updates)
  }

  const handleLogicalOperatorToggle = () => {
    updateCondition({ logicalOperator: condition.logicalOperator === 'AND' ? 'OR' : 'AND' })
  }

  // Auto-focus logic
  useEffect(() => {
    if (autoFocus) {
      hasTriggeredAutoFocus.current = false
    }
  }, [autoFocus])

  useEffect(() => {
    if (autoFocus &&
      !hasTriggeredAutoFocus.current &&
      !condition.event &&
      dropdownRef.current) {

      hasTriggeredAutoFocus.current = true

      const button = dropdownRef.current.querySelector('button')
      if (button) {
        const timeoutId = setTimeout(() => {
          if (dropdownRef.current &&
            button.isConnected &&
            !condition.event) {
            button.click()
          }
        }, 100)

        return () => clearTimeout(timeoutId)
      }
    }
  }, [autoFocus, condition.event])

  return (
    <div className="border-b last:border-b-0">
      <div className="p-4 flex items-center gap-3">
        <LogicalOperatorButton
          index={index}
          operator={condition.logicalOperator}
          onToggle={handleLogicalOperatorToggle}
        />
        <div className="flex-1" ref={dropdownRef}>
          <DropdownSelect
            title="Choose an event..."
            type={DropdownSelectType.SingleString}
            items={getEventNames()}
            initialSelected={condition.event}
            onChangeSelected={(item) => handleEventChange(item as string)}
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(index)}
          className="p-1 h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {condition.event && (
        <div className="px-4 pb-4">
          <EventFields condition={condition} onUpdate={updateCondition} />
        </div>
      )}
    </div>
  )
}

// CEL Generation Utilities
interface CELConditionItem {
  expression: string
  type: 'event' | 'session' | 'sampling'
  operator?: string
  index: number
}

class CELGenerator {
  private static formatAttributeCondition(fieldPath: string, attribute: AttributeWithOperator): string {
    const operator = SAMPLING_CONFIG.operatorMappings[attribute.operator as OperatorType]
    if (!operator || !attribute.value.trim()) return ''

    const isStringMethod = ['contains', 'startsWith', 'endsWith'].includes(attribute.operator)
    const escapedValue = attribute.value.replace(/"/g, '\\"') // Escape quotes in values
    return isStringMethod 
      ? `${fieldPath}${operator}("${escapedValue}")`
      : `${fieldPath}${operator}"${escapedValue}"`
  }

  private static generateEventConditionCEL(condition: EventCondition): string {
    const eventConfig = getEventConfig(condition.event)
    if (!eventConfig) return ''

    let cel = eventConfig.cel

    // Add event-specific attribute conditions
    if (eventConfig.type === 'custom') {
      if (condition.customEventName?.trim()) {
        const escapedEventName = condition.customEventName.replace(/"/g, '\\"')
        cel += ` && custom.name == "${escapedEventName}"`
      }
      if (condition.ud_event_attributes?.length) {
        const attrConditions = condition.ud_event_attributes
          .filter(attr => attr.key.trim() && attr.value.trim() && attr.type && (attr.type === 'boolean' || attr.condition))
          .map(attr => {
            const fieldPath = `custom.user_defined_attribute.${attr.key.trim()}`
            if (attr.type === 'boolean') {
              return `${fieldPath} == ${attr.value}`
            }
            return this.formatAttributeCondition(fieldPath, { value: attr.value, operator: attr.condition })
          })
          .filter(conditionStr => conditionStr) // Remove empty conditions
        
        if (attrConditions.length > 0) {
          cel += ` && (${attrConditions.join(' && ')})`
        }
      }
    } else if (eventConfig.type === 'http') {
      const { url: urlField, statusCode: statusCodeField } = getHttpAttributes()
      if (condition.httpUrl?.value) {
        const urlCondition = this.formatAttributeCondition(urlField.cel, condition.httpUrl)
        if (urlCondition) cel += ` && ${urlCondition}`
      }
      if (condition.httpStatusCode?.value) {
        const operator = SAMPLING_CONFIG.operatorMappings[condition.httpStatusCode.operator as OperatorType]
        if (operator) {
          cel += ` && ${statusCodeField.cel}${operator}${condition.httpStatusCode.value}`
        }
      }
    } else if (eventConfig.type === 'click') {
      const { targetId: targetIdField, targetClass: targetClassField } = getClickAttributes()
      if (condition.targetId?.value) {
        const targetIdCondition = this.formatAttributeCondition(targetIdField.cel, condition.targetId)
        if (targetIdCondition) cel += ` && ${targetIdCondition}`
      }
      if (condition.targetClass?.value) {
        const targetClassCondition = this.formatAttributeCondition(targetClassField.cel, condition.targetClass)
        if (targetClassCondition) cel += ` && ${targetClassCondition}`
      }
    } else if (eventConfig.type === 'screen') {
      const screenField = getScreenField(condition.event)
      if (condition.screenField?.value?.trim() && screenField) {
        const screenCondition = this.formatAttributeCondition(screenField.cel, condition.screenField)
        if (screenCondition) cel += ` && ${screenCondition}`
      }
    }

    return cel
  }

  private static generateSessionConditionCEL(condition: SessionCondition): string {
    const sessionAttr = getSessionAttribute(condition.attribute)
    if (!sessionAttr || !condition.value?.trim()) return ''

    if (sessionAttr.type === 'boolean') {
      return `${sessionAttr.cel} == ${condition.value}`
    }

    return this.formatAttributeCondition(sessionAttr.cel, { value: condition.value, operator: condition.operator })
  }

  static generateConditionItems(eventConditions: EventCondition[], sessionConditions: SessionCondition[], samplingRate: string): CELConditionItem[] {
    const items: CELConditionItem[] = []

    // Add event conditions
    eventConditions.forEach((condition, index) => {
      const expression = this.generateEventConditionCEL(condition)
      if (expression) {
        items.push({
          expression,
          type: 'event',
          operator: index > 0 ? (condition.logicalOperator === 'OR' ? '||' : '&&') : undefined,
          index
        })
      }
    })

    // Add session conditions
    sessionConditions.forEach((condition, index) => {
      const expression = this.generateSessionConditionCEL(condition)
      if (expression) {
        const hasEventConditions = eventConditions.some(ec => this.generateEventConditionCEL(ec))
        const isFirstOverall = !hasEventConditions && index === 0
        
        items.push({
          expression,
          type: 'session',
          operator: isFirstOverall ? undefined : (condition.logicalOperator === 'OR' ? '||' : '&&'),
          index
        })
      }
    })

    // Add sampling condition
    if (isValidSamplingRate(samplingRate)) {
      const rate = parseFloat(samplingRate)
      if (rate < 100 && rate > 0) {
        const decimalRate = rate / 100
        items.push({
          expression: `random() < ${decimalRate}`,
          type: 'sampling',
          operator: items.length > 0 ? '&&' : undefined,
          index: 0
        })
      }
    }

    return items
  }
}

// CEL Preview Component
interface CELPreviewProps {
  eventConditions: EventCondition[]
  sessionConditions: SessionCondition[]
  samplingRate: string
}

function CELPreview({ eventConditions, sessionConditions, samplingRate }: CELPreviewProps) {
  const conditionItems = CELGenerator.generateConditionItems(eventConditions, sessionConditions, samplingRate)

  return (
    <div className="border-2 border-dashed border-gray-300 bg-gray-50">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-medium text-muted-foreground">CEL Expression Preview</h2>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-gray-500 cursor-help">(?)</span>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start" className="font-display max-w-96 text-sm text-white fill-neutral-800 bg-neutral-800">
              <div className="p-2">
                <p className="text-xs">
                  This shows the Common Expression Language (CEL) representation of your sampling rule conditions.
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="bg-white border rounded p-3 font-mono text-sm text-gray-800 space-y-1">
          {conditionItems.length === 0 ? (
            <div className="text-gray-500 italic">No conditions specified</div>
          ) : (
            conditionItems.map((item) => (
              <div key={`${item.type}-${item.index}`}>
                <code className="break-all">
                  {item.operator && `${item.operator} `}({item.expression})
                </code>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// Generic Condition Box Component
interface ConditionBoxProps<T> {
  title: string
  conditions: T[]
  onAddCondition: () => void
  children: React.ReactNode
}

function ConditionBox<T>({ title, conditions, onAddCondition, children }: ConditionBoxProps<T>) {
  return (
    <div className="border">
      <div className="p-4 flex justify-between items-center">
        <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddCondition}
          disabled={conditions.length >= MAX_CONDITIONS}
        >
          + Add condition
        </Button>
      </div>
      {conditions.length > 0 && (
        <div className="border-t">
          {children}
        </div>
      )}
    </div>
  )
}

export default function Sampling({ }: { params: { teamId: string } }) {
  const [samplingType, setSamplingType] = useState<SamplingType>(SamplingType.Session)
  const [ruleName, setRuleName] = useState<string>('')
  const [eventConditions, setEventConditions] = useState<EventCondition[]>([])
  const [sessionConditions, setSessionConditions] = useState<SessionCondition[]>([])
  const [samplingRate, setSamplingRate] = useState<string>('100')
  const [conditionGroupOperator, setConditionGroupOperator] = useState<'AND' | 'OR'>('AND')

  // Event condition handlers
  const addEventCondition = () => {
    if (eventConditions.length < MAX_CONDITIONS) {
      setEventConditions(prev => [...prev, { event: '', logicalOperator: 'AND' }])
    }
  }

  const updateEventCondition = (index: number, value: EventCondition) => {
    setEventConditions(prev => {
      const newConditions = [...prev]
      newConditions[index] = value
      return newConditions
    })
  }

  const removeEventCondition = (index: number) => {
    setEventConditions(prev => prev.filter((_, i) => i !== index))
  }

  // Session condition handlers
  const addSessionCondition = () => {
    if (sessionConditions.length < MAX_CONDITIONS) {
      setSessionConditions(prev => [...prev, { attribute: '', operator: '', value: '', logicalOperator: 'AND' }])
    }
  }

  const updateSessionCondition = (index: number, attribute: keyof SessionCondition, value: string) => {
    setSessionConditions(prev => {
      const newConditions = [...prev]
      newConditions[index] = { ...newConditions[index], [attribute]: value }
      return newConditions
    })
  }

  const removeSessionCondition = (index: number) => {
    setSessionConditions(prev => prev.filter((_, i) => i !== index))
  }

  // Helper function to check if there are any valid rules
  const hasValidRules = () => {
    const hasName = ruleName && ruleName.trim() !== ''
    const hasEventRules = eventConditions.some(condition => condition.event && condition.event.trim() !== '')
    const hasSessionRules = sessionConditions.some(condition => 
      condition.attribute && condition.attribute.trim() !== '' &&
      condition.value && condition.value.trim() !== ''
    )
    return hasName && (hasEventRules || hasSessionRules)
  }

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start">
      <div className="flex flex-row items-center gap-2 justify-between w-full">
        <p className="font-display text-4xl max-w-6xl text-center">Configure sampling rule</p>
        <Button
          variant="outline"
          className={`font-display border select-none ${
            hasValidRules() 
              ? 'border-black hover:bg-black hover:text-white' 
              : 'border-gray-300 text-gray-400 cursor-not-allowed'
          }`}
          onClick={() => {
            if (hasValidRules()) {
              // TODO: Implement publish rule functionality
            }
          }}
          disabled={!hasValidRules()}
        >
          Publish Rule
        </Button>
      </div>
      
      <div className="mt-6 mb-4 max-w-4xl">
        <p className="text-base text-muted-foreground">
          Choose when to collect sessions by adding conditions below. For example, collect sessions when crashes happen or when users visit specific screens.
        </p>
      </div>

      {/* TabSelect for sampling type */}
      <div className="w-full flex justify-start pt-6 pb-2">
        <TabSelect
          items={Object.values(SamplingType)}
          selected={samplingType}
          onChangeSelected={item => {
            setSamplingType(item as SamplingType)
          }}
        />
      </div>

      {samplingType === SamplingType.Session ? (
        <>

      <div className="flex flex-col mt-4 w-full space-y-4">
        {/* Rule Name */}
        <div className="border p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-muted-foreground">Rule name</h2>
          </div>
          <Input
            type="text"
            placeholder="Enter a name for this sampling rule"
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Event Conditions */}
        <ConditionBox
          title="Event conditions"
          conditions={eventConditions}
          onAddCondition={addEventCondition}
        >
          {eventConditions.map((condition, index) => (
            <EventConditionRow
              key={index}
              condition={condition}
              index={index}
              items={getEventNames()}
              onConditionChange={updateEventCondition}
              onRemove={removeEventCondition}
              autoFocus={index === eventConditions.length - 1}
            />
          ))}
        </ConditionBox>

        {/* Logical Operator Between Condition Types */}
        {eventConditions.length > 0 && sessionConditions.length > 0 && (
          <div className="flex justify-center py-2">
            <div className="flex items-center gap-1 px-3 py-2 bg-gray-50 rounded-full border">
              <button
                onClick={() => setConditionGroupOperator('AND')}
                className={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${
                  conditionGroupOperator === 'AND'
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'text-muted-foreground hover:text-gray-700'
                }`}
              >
                AND
              </button>
              <button
                onClick={() => setConditionGroupOperator('OR')}
                className={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${
                  conditionGroupOperator === 'OR'
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'text-muted-foreground hover:text-gray-700'
                }`}
              >
                OR
              </button>
            </div>
          </div>
        )}

        {/* Session Conditions */}
        <ConditionBox
          title="Device, user or version conditions"
          conditions={sessionConditions}
          onAddCondition={addSessionCondition}
        >
          {sessionConditions.map((condition, index) => (
            <SessionConditionRow
              key={index}
              condition={condition}
              index={index}
              onUpdate={updateSessionCondition}
              onRemove={removeSessionCondition}
            />
          ))}
        </ConditionBox>

        {/* Sampling */}
        <div className="border p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Sampling</h2>
          <p className="text-sm text-gray-600 mb-3">Set the percentage of sessions to collect when conditions are met</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={samplingRate}
              onChange={(e) => setSamplingRate(e.target.value)}
              min="0"
              max="100"
              step="1"
              className={`w-20 p-2 border rounded text-sm ${
                !isValidSamplingRate(samplingRate) ? 'border-red-500' : ''
              }`}
            />
            <span className="text-sm text-gray-600">%</span>
            {!isValidSamplingRate(samplingRate) && (
              <span className="text-xs text-red-500">Must be 0-100</span>
            )}
          </div>
        </div>

          {/* CEL Preview */}
          <CELPreview
            eventConditions={eventConditions}
            sessionConditions={sessionConditions}
            samplingRate={samplingRate}
          />
        </div>
        </>
      ) : (
        <div className="mt-2 mb-8 max-w-4xl">
          <div className="border border-dashed border-gray-300 rounded-lg p-12 text-center">
            <p className="text-lg font-medium text-muted-foreground mb-2">Trace Sampling</p>
            <p className="text-base text-muted-foreground">
              Work in progress - Trace sampling configuration will be available soon.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}