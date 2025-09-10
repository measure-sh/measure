import {
  generateRule,
  generateTraceRuleCel,
  generateSessionRuleCel,
  validateCelExpression,
  getDefaultOperatorForType
} from '@/app/utils/cel-utils'
import { describe, expect, it } from '@jest/globals'

describe('cel-utils', () => {
  describe('generateEventRuleCel', () => {
    it('should generate CEL for event type only', () => {
      const eventConditions = {
        conditions: [{ type: "exception", attrs: null, udAttrs: null }],
        operators: []
      }
      const sessionConditions = { conditions: [], operators: [] }

      expect(generateRule(eventConditions, sessionConditions)).toBe('(event_type == "exception")')
    })

    it('should generate CEL for event with attributes', () => {
      const eventConditions = {
        conditions: [{
          type: "exception",
          attrs: [{ key: "handled", type: "bool", value: false }],
          udAttrs: null
        }],
        operators: []
      }
      const sessionConditions = { conditions: [], operators: [] }

      expect(generateRule(eventConditions, sessionConditions)).toBe('(event_type == "exception" && exception.handled == false)')
    })

    it('should combine event and session conditions with AND', () => {
      const eventConditions = {
        conditions: [{ type: "exception", attrs: null, udAttrs: null }],
        operators: []
      }
      const sessionConditions = {
        conditions: [{
          attrs: [{ key: "app_version", type: "string", value: "1.0" }]
        }],
        operators: []
      }

      expect(generateRule(eventConditions, sessionConditions)).toBe('(event_type == "exception") && (attribute.app_version == "1.0")')
    })

    it('should handle multiple event conditions with OR operator', () => {
      const eventConditions = {
        conditions: [
          { type: "exception", attrs: null, udAttrs: null },
          { type: "anr", attrs: null, udAttrs: null }
        ],
        operators: ['OR' as const]
      }
      const sessionConditions = { conditions: [], operators: [] }

      expect(generateRule(eventConditions, sessionConditions)).toBe('((event_type == "exception") || (event_type == "anr"))')
    })

    it('should handle multiple event conditions with mixed operators', () => {
      const eventConditions = {
        conditions: [
          { type: "exception", attrs: [{ key: "handled", type: "bool", value: false }], udAttrs: null },
          { type: "anr", attrs: null, udAttrs: null },
          { type: "crash", attrs: [{ key: "severity", type: "string", value: "high" }], udAttrs: null }
        ],
        operators: ['AND' as const, 'OR' as const]
      }
      const sessionConditions = { conditions: [], operators: [] }

      expect(generateRule(eventConditions, sessionConditions)).toBe('((event_type == "exception" && exception.handled == false) && (event_type == "anr") || (event_type == "crash" && crash.severity == "high"))')
    })

    it('should generate CEL for session conditions only', () => {
      const eventConditions = { conditions: [], operators: [] }
      const sessionConditions = {
        conditions: [{
          attrs: [{ key: "app_version", type: "string", value: "2.0" }]
        }],
        operators: []
      }

      expect(generateRule(eventConditions, sessionConditions)).toBe('(attribute.app_version == "2.0")')
    })

    it('should return null for empty conditions', () => {
      const eventConditions = { conditions: [], operators: [] }
      const sessionConditions = { conditions: [], operators: [] }

      expect(generateRule(eventConditions, sessionConditions)).toBe(null)
    })
  })

  describe('generateTraceRuleCel', () => {
    it('should generate CEL for span name only', () => {
      const traceConditions = {
        conditions: [{ spanName: "MainActivity", udAttrs: null }],
        operators: []
      }
      const sessionConditions = { conditions: [], operators: [] }

      expect(generateTraceRuleCel(traceConditions, sessionConditions)).toBe('(span.name.startWith("MainActivity"))')
    })

    it('should generate CEL for span user defined attributes', () => {
      const traceConditions = {
        conditions: [{
          spanName: "UserActivity",
          udAttrs: [{ key: "user_id", type: "string", value: "12345" }]
        }],
        operators: []
      }
      const sessionConditions = { conditions: [], operators: [] }

      expect(generateTraceRuleCel(traceConditions, sessionConditions)).toBe('(span.name.startWith("UserActivity") && span.user_defined_attrs.user_id == "12345")')
    })

    it('should combine trace and session conditions with AND', () => {
      const traceConditions = {
        conditions: [{ spanName: "Activity", udAttrs: null }],
        operators: []
      }
      const sessionConditions = {
        conditions: [{
          attrs: [{ key: "platform", type: "string", value: "android" }]
        }],
        operators: []
      }

      expect(generateTraceRuleCel(traceConditions, sessionConditions)).toBe('(span.name.startWith("Activity")) && (attribute.platform == "android")')
    })

    it('should handle multiple trace conditions with mixed operators', () => {
      const traceConditions = {
        conditions: [
          { spanName: "MainActivity", udAttrs: [{ key: "user_id", type: "string", value: "123" }] },
          { spanName: "Fragment", udAttrs: null },
          { spanName: "Activity", udAttrs: [{ key: "level", type: "number", value: 5 }] }
        ],
        operators: ['OR' as const, 'AND' as const]
      }
      const sessionConditions = { conditions: [], operators: [] }

      expect(generateTraceRuleCel(traceConditions, sessionConditions)).toBe('((span.name.startWith("MainActivity") && span.user_defined_attrs.user_id == "123") || (span.name.startWith("Fragment")) && (span.name.startWith("Activity") && span.user_defined_attrs.level == 5))')
    })

    it('should generate CEL for session conditions only', () => {
      const traceConditions = { conditions: [], operators: [] }
      const sessionConditions = {
        conditions: [{
          attrs: [{ key: "platform", type: "string", value: "ios" }]
        }],
        operators: []
      }

      expect(generateTraceRuleCel(traceConditions, sessionConditions)).toBe('(attribute.platform == "ios")')
    })
  })

  describe('generateSessionRuleCel', () => {
    it('should generate CEL for session attributes', () => {
      const sessionConditions = {
        conditions: [{
          attrs: [{ key: "app_version", type: "string", value: "2.0", operator: "startsWith" }]
        }],
        operators: []
      }

      expect(generateSessionRuleCel(sessionConditions)).toBe('(attribute.app_version.startWith("2.0"))')
    })

    it('should handle multiple session conditions with AND operator', () => {
      const sessionConditions = {
        conditions: [
          { attrs: [{ key: "platform", type: "string", value: "ios" }] },
          { attrs: [{ key: "version_code", type: "number", value: 100 }] }
        ],
        operators: ['AND' as const]
      }

      expect(generateSessionRuleCel(sessionConditions)).toBe('((attribute.platform == "ios") && (attribute.version_code == 100))')
    })

    it('should return null for empty session conditions', () => {
      const sessionConditions = { conditions: [], operators: [] }

      expect(generateSessionRuleCel(sessionConditions)).toBe(null)
    })
  })

  describe('validateCelExpression', () => {
    it('should validate balanced parentheses', () => {
      expect(validateCelExpression('(event_type == "exception")')).toBe(true)
      expect(validateCelExpression('((event_type == "exception") && (handled == false))')).toBe(true)
      expect(validateCelExpression('event_type == "exception"')).toBe(true)
    })

    it('should reject unbalanced parentheses', () => {
      expect(validateCelExpression('(event_type == "exception"')).toBe(false)
      expect(validateCelExpression('event_type == "exception"))')).toBe(false)
      expect(validateCelExpression(')event_type == "exception"(')).toBe(false)
    })

    it('should reject empty or null expressions', () => {
      expect(validateCelExpression('')).toBe(false)
      expect(validateCelExpression('   ')).toBe(false)
    })
  })

  describe('getDefaultOperatorForType', () => {
    it('should return eq for all supported types', () => {
      expect(getDefaultOperatorForType('string')).toBe('eq')
      expect(getDefaultOperatorForType('bool')).toBe('eq')
      expect(getDefaultOperatorForType('boolean')).toBe('eq')
      expect(getDefaultOperatorForType('int64')).toBe('eq')
      expect(getDefaultOperatorForType('float64')).toBe('eq')
      expect(getDefaultOperatorForType('number')).toBe('eq')
      expect(getDefaultOperatorForType('unknown')).toBe('eq')
    })
  })

  describe('string operators', () => {
    it('should generate contains operator for event attributes', () => {
      const eventConditions = {
        conditions: [{
          type: "exception",
          attrs: [{ key: "message", type: "string", value: "error", operator: "contains" }],
          udAttrs: null
        }],
        operators: []
      }
      const sessionConditions = { conditions: [], operators: [] }

      expect(generateRule(eventConditions, sessionConditions)).toBe('(event_type == "exception" && exception.message.contains("error"))')
    })

    it('should generate startsWith operator for user defined attributes', () => {
      const eventConditions = {
        conditions: [{
          type: "http",
          attrs: null,
          udAttrs: [{ key: "url", type: "string", value: "https://", operator: "startsWith" }]
        }],
        operators: []
      }
      const sessionConditions = { conditions: [], operators: [] }

      expect(generateRule(eventConditions, sessionConditions)).toBe('(event_type == "http" && user_defined_attrs.url.startWith("https://"))')
    })

    it('should generate startsWith operator for session attributes', () => {
      const sessionConditions = {
        conditions: [{
          attrs: [{ key: "device_model", type: "string", value: "iPhone", operator: "startsWith" }]
        }],
        operators: []
      }

      expect(generateSessionRuleCel(sessionConditions)).toBe('(attribute.device_model.startWith("iPhone"))')
    })
  })
})