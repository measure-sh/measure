"use client"

import { useState, useEffect } from 'react'
import TabSelect from '@/app/components/tab_select'
import { Button } from '@/app/components/button'
import { ChevronDown, ChevronRight, Copy } from 'lucide-react'
import { formatDateToHumanReadableDate, formatDateToHumanReadableTime } from '@/app/utils/time_utils'
import { measureAuth, MeasureAuthSession } from '@/app/auth/measure_auth'
import DangerConfirmationDialog from '@/app/components/danger_confirmation_dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/table'

enum SamplingType {
  Session = "Session",
  Trace = "Trace",
}

interface SamplingRule {
  id: string
  expression: string
  samplingType: SamplingType
  enabled: boolean
  createdAt: string
  updatedAt: string
  createdBy: string
}

export default function Sampling({ params }: { params: { teamId: string } }) {
  const [samplingType, setSamplingType] = useState<SamplingType>(SamplingType.Session)
  const [celExpression, setCelExpression] = useState<string>("")
  const [showExamples, setShowExamples] = useState<boolean>(false)
  const [copyMessage, setCopyMessage] = useState<string>("")
  const [session, setSession] = useState<MeasureAuthSession | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false)

  // Multiple rules state management
  const [rules, setRules] = useState<SamplingRule[]>([
    {
      id: "1",
      expression: 'type == "exception" && exception.handled == false',
      samplingType: SamplingType.Session,
      enabled: true,
      createdAt: "2024-08-03T10:30:00Z",
      updatedAt: "2024-08-03T10:30:00Z",
      createdBy: "john.doe@company.com"
    },
    {
      id: "2",
      expression: 'type == "exception" && exception.handled == false && attribute.platform == "android"',
      samplingType: SamplingType.Session,
      enabled: false,
      createdAt: "2024-08-03T14:15:00Z",
      updatedAt: "2024-08-03T14:15:00Z",
      createdBy: "john.doe@company.com"
    }
  ])

  const handleAddRuleClick = () => {
    if (!celExpression.trim()) return
    
    // Check if rule already exists
    const existingRule = rules.find(rule => 
      rule.expression.trim() === celExpression.trim() && 
      rule.samplingType === samplingType
    )
    
    if (existingRule) {
      return // Rule already exists, don't show dialog
    }
    
    setShowConfirmDialog(true)
  }

  const confirmAddRule = () => {
    const now = new Date().toISOString()
    const user = session?.user.email || "unknown@company.com"
    
    const newRule: SamplingRule = {
      id: Date.now().toString(),
      expression: celExpression,
      samplingType,
      enabled: true,
      createdAt: now,
      updatedAt: now,
      createdBy: user
    }
    
    setRules([newRule, ...rules])
    setCelExpression("") // Clear form after adding
    setShowConfirmDialog(false)
  }

  const cancelAddRule = () => {
    setShowConfirmDialog(false)
  }

  const toggleRuleStatus = (ruleId: string) => {
    const now = new Date().toISOString()
    setRules(rules.map(rule => 
      rule.id === ruleId 
        ? { ...rule, enabled: !rule.enabled, updatedAt: now }
        : rule
    ))
  }


  // Check if current expression is valid and doesn't duplicate existing rules
  const canAddRule = () => {
    if (!celExpression.trim()) return false
    
    const existingRule = rules.find(rule => 
      rule.expression.trim() === celExpression.trim() && 
      rule.samplingType === samplingType
    )
    
    return !existingRule
  }

  // Fetch user session
  useEffect(() => {
    const fetchSession = async () => {
      const { session } = await measureAuth.getSession()
      setSession(session)
    }
    fetchSession()
  }, [])


  const copyLLMPrompt = async () => {
    const prompt = `Help me write a CEL (Common Expression Language) expression for filtering Measure.sh events to collect specific sessions.

Context:
- I'm building a sampling rule to collect sessions that match certain criteria
- Current expression: ${celExpression || "(none)"}
- Target: ${samplingType} sampling

Available Event Types and Properties:
- exception: type, handled, foreground, exceptions[], threads[]
- gesture_click: target, target_id, x, y, width, height, touch_down_time, touch_up_time
- gesture_long_click: target, target_id, x, y, width, height, touch_down_time, touch_up_time
- gesture_scroll: target, target_id, x, y, end_x, end_y, direction, touch_down_time, touch_up_time
- http: url, method, status_code, start_time, end_time, failure_reason, client
- lifecycle_app: type (foreground, background, terminated)
- lifecycle_activity: type, class_name, intent, saved_instance_state
- screen_view: name
- custom: name

Available Attributes:
- attribute.platform (android, ios, flutter)
- attribute.app_version
- attribute.os_version
- attribute.device_name
- attribute.device_manufacturer
- attribute.user_id
- user_defined_attribute.* (any custom user attributes)

Common Patterns:
- Equality: field == "value"
- Comparison: field >= 10
- String operations: field.contains("text"), field.startsWith("prefix")
- Logical: expr1 && expr2, expr1 || expr2
- Null checks: field != null

Example expressions:
- Crashes: type == "exception" && exception.handled == false
- Network errors: type == "http" && http.status_code >= 400
- Specific user interactions: type == "gesture_click" && gesture_click.target.contains("LoginButton")
- Platform filtering: attribute.platform == "android" && attribute.os_version >= "13"

Please help me write a CEL expression for: [describe your use case here]`

    try {
      await navigator.clipboard.writeText(prompt)
      setCopyMessage("Prompt copied to clipboard!")
      setTimeout(() => setCopyMessage(""), 3000)
    } catch (err) {
      setCopyMessage("Failed to copy prompt")
      setTimeout(() => setCopyMessage(""), 3000)
    }
  }

  const examples = [
    {
      description: "Collect all sessions",
      expression: `true`
    },
    {
      description: "Collect sessions with crashes or bug reports",
      expression: `(type == "exception" && exception.handled == false)
      || type == "anr"
      || type == "bug_report"`
    },
    {
      description: "Collect sessions for only premium subscription users",
      expression: `user_defined_attribute.subscription == "premium"`
    },
    {
      description: "Collect sessions if user clicked help button",
      expression: `type == "gesture_click" && gesture_click.target_id.contains("btn_help")`
    },
    {
      description: "Multiple conditions with logical operators",
      expression: `(type == "gesture_click" && gesture_click.target_id.contains("btn_help")) 
      || user_defined_attribute.subscription == "premium"`
    }
  ]

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start">
      <p className="font-display text-4xl max-w-6xl text-center">Sampling</p>
      <div className="py-4" />

      {/* Toggle for sampling type */}
      <div className="w-full flex justify-start pb-4">
        <TabSelect
          items={Object.values(SamplingType)}
          selected={samplingType}
          onChangeSelected={(item) => setSamplingType(item as SamplingType)}
        />
      </div>

      {/* Session Sampling Content */}
      {samplingType === SamplingType.Session && (
        <div className="w-full mb-8 space-y-4">
          {/* CEL Expression input with buttons */}
          <div className="w-full space-y-4">
            <div className="space-y-2">
              <textarea
                className="w-full border border-black rounded-md outline-hidden focus-visible:outline-yellow-300 py-2 px-4 font-body placeholder:text-neutral-400 resize-vertical"
                id="cel-expression"
                placeholder="Enter rule..."
                value={celExpression}
                onChange={(e) => setCelExpression(e.target.value)}
                rows={3}
              />
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setShowExamples(!showExamples)}
                  className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800 font-body"
                >
                  {showExamples ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  How to write sampling rules?
                </button>
                <div className="flex gap-2 items-center">
                  {copyMessage && (
                    <span className="text-sm text-green-600 font-body">{copyMessage}</span>
                  )}
                  <Button
                    variant="outline"
                    onClick={copyLLMPrompt}
                    className="font-display border border-black flex items-center gap-1"
                  >
                    <Copy className="h-4 w-4" />
                    Copy LLM Prompt
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleAddRuleClick}
                    className="font-display border border-black"
                    disabled={!canAddRule()}
                  >
                    Add Rule
                  </Button>
                </div>
              </div>
            </div>

            {/* Examples section */}
            {showExamples && (
              <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
                <div className="mb-6 space-y-4">
                  <p className="text-gray-700 font-body text-sm">
                    Write rules to automatically collect session timelines when specific events occur.
                    When your rule evaluates to <code className="bg-gray-100 px-1 rounded font-mono">true</code> for any event in a session, the entire session timeline is captured.
                  </p>

                  <p className="text-gray-700 font-body text-sm">
                    For example, the default rule collects sessions with crashes or user-reported bugs:
                  </p>

                  <code
                    className="block bg-white border border-gray-200 rounded px-3 py-2 text-sm font-mono cursor-pointer hover:bg-gray-50"
                    onClick={() => setCelExpression(`(type == "exception" && exception.handled == false)
|| type == "anr"
|| type == "bug_report"`)}
                    title="Click to use this expression"
                  >
                    (type == "exception" && exception.handled == false)
                    || type == "anr"
                    || type == "bug_report"
                  </code>

                  <div>
                    <p className="font-body text-sm text-gray-700 mb-2">
                      You can compare values using <code className="bg-gray-100 px-1 rounded font-mono text-xs">==</code> <code className="bg-gray-100 px-1 rounded font-mono text-xs">!=</code> <code className="bg-gray-100 px-1 rounded font-mono text-xs">&gt;</code> <code className="bg-gray-100 px-1 rounded font-mono text-xs">&lt;</code> <code className="bg-gray-100 px-1 rounded font-mono text-xs">&gt;=</code> <code className="bg-gray-100 px-1 rounded font-mono text-xs">&lt;=</code>,
                      combine conditions with <code className="bg-gray-100 px-1 rounded font-mono text-xs">&amp;&amp;</code> <code className="bg-gray-100 px-1 rounded font-mono text-xs">||</code>,
                      and search text with <code className="bg-gray-100 px-1 rounded font-mono text-xs">.contains()</code> <code className="bg-gray-100 px-1 rounded font-mono text-xs">.startsWith()</code> <code className="bg-gray-100 px-1 rounded font-mono text-xs">.endsWith()</code>.

                      Use parentheses <code className="bg-gray-100 px-1 rounded font-mono text-xs">()</code> to group conditions and
                      <code className="bg-gray-100 px-1 rounded font-mono text-xs">||</code> to combine multiple event types.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-display text-md font-semibold text-gray-800 mb-3">Examples:</h4>
                  {examples.map((example, index) => (
                    <div key={index} className="space-y-1">
                      <p className="text-sm text-gray-600 font-body">
                        {example.description}
                      </p>
                      <code
                        className="block bg-white border border-gray-200 rounded px-3 py-2 text-sm font-mono cursor-pointer hover:bg-gray-50"
                        onClick={() => setCelExpression(example.expression)}
                        title="Click to use this expression"
                      >
                        {example.expression}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Trace Sampling Content - Empty for now */}
      {samplingType === SamplingType.Trace && (
        <div className="w-full mb-8">
          <div className="border border-gray-200 rounded-md p-12 text-center">
            <p className="text-gray-500 font-body text-lg">Trace sampling coming soon</p>
            <p className="text-gray-400 font-body text-sm mt-2">This feature is currently under development</p>
          </div>
        </div>
      )}

      {/* Current Rules Table - Only for Session Sampling */}
      {samplingType === SamplingType.Session && (
        <div className="w-full">
          {rules.length === 0 ? (
            <p className="text-gray-500 font-body">No rules created yet</p>
          ) : (
            <Table className="font-display">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50%]">Rules</TableHead>
                  <TableHead className="w-[20%]">Created By</TableHead>
                  <TableHead className="w-[20%]">Updated At</TableHead>
                  <TableHead className="w-[10%]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id} className="font-body group">
                    <TableCell className="w-[50%]">
                      <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                        {rule.expression}
                      </code>
                    </TableCell>
                    <TableCell className="w-[20%] text-sm text-gray-600 font-body">
                      {rule.createdBy}
                    </TableCell>
                    <TableCell className="w-[20%] text-sm text-gray-400 font-body">
                      {formatDateToHumanReadableDate(rule.updatedAt)} at {formatDateToHumanReadableTime(rule.updatedAt)}
                    </TableCell>
                    <TableCell className="w-[10%]">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={() => toggleRuleStatus(rule.id)}
                          className="sr-only peer"
                        />
                        <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-200/75 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-400"></div>
                      </label>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* Add Rule Confirmation Dialog */}
      <DangerConfirmationDialog
        open={showConfirmDialog}
        body={
          <div className="space-y-3">
            <p className="font-body">
              Are you sure you want to add this sampling rule?
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded p-3">
              <code className="text-sm font-mono">{celExpression}</code>
            </div>
          </div>
        }
        affirmativeText="Add Rule"
        cancelText="Cancel"
        onAffirmativeAction={confirmAddRule}
        onCancelAction={cancelAddRule}
      />
    </div>
  )
}