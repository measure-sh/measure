import { celToConditions } from "@/app/utils/cel/cel_parser";

describe('CEL Parser', () => {
    test('parses single event type condition', () => {
        const cel = '(event_type == "anr")';
        const conditions = celToConditions(cel);

        expect(conditions.event).toBeDefined();
        expect(conditions.event!.conditions).toHaveLength(1);
        expect(conditions.event!.conditions[0]).toMatchObject({
            type: 'anr',
            attrs: [],
            ud_attrs: []
        });
        expect(conditions.event!.operators).toHaveLength(0);
        expect(conditions.trace).toBeUndefined();
    });

    test('parses multiple event conditions with AND operator', () => {
        const cel = '((event_type == "anr") && (event_type == "exception"))';
        const conditions = celToConditions(cel);

        expect(conditions.event).toBeDefined();
        expect(conditions.event!.conditions).toHaveLength(2);
        expect(conditions.event!.conditions[0].type).toBe('anr');
        expect(conditions.event!.conditions[1].type).toBe('exception');
        expect(conditions.event!.operators).toEqual(['AND']);
    });

    test('parses multiple event conditions with OR operator', () => {
        const cel = '((event_type == "anr") || (event_type == "exception"))';
        const conditions = celToConditions(cel);

        expect(conditions.event).toBeDefined();
        expect(conditions.event!.conditions).toHaveLength(2);
        expect(conditions.event!.conditions[0].type).toBe('anr');
        expect(conditions.event!.conditions[1].type).toBe('exception');
        expect(conditions.event!.operators).toEqual(['OR']);
    });

    test('parses event with attribute', () => {
        const cel = '(event_type == "exception" && exception.handled == false)';
        const conditions = celToConditions(cel);

        expect(conditions.event).toBeDefined();
        expect(conditions.event!.conditions).toHaveLength(1);

        const condition = conditions.event!.conditions[0];
        expect(condition.type).toBe('exception');
        expect(condition.attrs).toHaveLength(1);
        expect(condition.attrs![0]).toMatchObject({
            key: 'handled',
            type: 'bool',
            value: false,
            operator: 'eq'
        });
    });

    test('parses event with user-defined attribute', () => {
        const cel = '(event_type == "custom" && event.user_defined_attrs.is_premium_user == true)';
        const conditions = celToConditions(cel);

        expect(conditions.event).toBeDefined();
        expect(conditions.event!.conditions).toHaveLength(1);

        const condition = conditions.event!.conditions[0];
        expect(condition.type).toBe('custom');
        expect(condition.ud_attrs).toHaveLength(1);
        expect(condition.ud_attrs![0]).toMatchObject({
            key: 'is_premium_user',
            type: 'bool',
            value: true,
            operator: 'eq'
        });
    });

    test('parses event with both regular and user-defined attributes', () => {
        const cel = '(event_type == "custom" && custom.name == "login" && event.user_defined_attrs.is_premium_user == true)';
        const conditions = celToConditions(cel);

        expect(conditions.event).toBeDefined();
        expect(conditions.event!.conditions).toHaveLength(1);

        const condition = conditions.event!.conditions[0];
        expect(condition.type).toBe('custom');
        expect(condition.attrs).toHaveLength(1);
        expect(condition.attrs![0]).toMatchObject({
            key: 'name',
            type: 'string',
            value: 'login',
            operator: 'eq'
        });
        expect(condition.ud_attrs).toHaveLength(1);
        expect(condition.ud_attrs![0]).toMatchObject({
            key: 'is_premium_user',
            type: 'bool',
            value: true,
            operator: 'eq'
        });
    });

    test('parses span name condition', () => {
        const cel = '(span_name == "Activity TTID")';
        const conditions = celToConditions(cel);

        expect(conditions.trace).toBeDefined();
        expect(conditions.trace!.conditions).toHaveLength(1);
        expect(conditions.trace!.conditions[0]).toMatchObject({
            spanName: 'Activity TTID',
            operator: 'eq',
            ud_attrs: []
        });
        expect(conditions.event).toBeUndefined();
    });

    test('parses multiple span conditions with AND operator', () => {
        const cel = '((span_name == "Activity TTID") && (span_name.startsWith("HTTP GET /config")))';
        const conditions = celToConditions(cel);

        expect(conditions.trace).toBeDefined();
        expect(conditions.trace!.conditions).toHaveLength(2);
        expect(conditions.trace!.operators).toEqual(['AND']);
        expect(conditions.trace!.conditions[0].spanName).toBe('Activity TTID');
        expect(conditions.trace!.conditions[1].spanName).toBe('HTTP GET /config');
        expect(conditions.trace!.conditions[1].operator).toBe('startsWith');
    });

    test('parses span condition with user-defined attributes', () => {
        const cel = '(span_name == "Activity TTID" && trace.user_defined_attrs.api_level >= 21)';
        const conditions = celToConditions(cel);

        expect(conditions.trace).toBeDefined();
        expect(conditions.trace!.conditions).toHaveLength(1);

        const condition = conditions.trace!.conditions[0];
        expect(condition.spanName).toBe('Activity TTID');
        expect(condition.ud_attrs).toHaveLength(1);
        expect(condition.ud_attrs![0]).toMatchObject({
            key: 'api_level',
            type: 'number',
            value: 21,
            operator: 'gte'
        });
    });

    test('parses combined event and session conditions', () => {
        const cel = '(event_type == "anr" && attribute.is_device_foldable == true)';
        const conditions = celToConditions(cel);

        expect(conditions.event).toBeDefined();

        expect(conditions.event!.conditions).toHaveLength(1);
        expect(conditions.event!.conditions[0].type).toBe('anr');

        expect(conditions.event!.conditions[0].session_attrs!).toHaveLength(1);
        expect(conditions.event!.conditions[0].session_attrs[0].key).toBe('is_device_foldable');
    });

    test('parses condition with contains operator', () => {
        const cel = '(event_type == "custom" && custom.name.contains("log"))';
        const conditions = celToConditions(cel);

        expect(conditions.event).toBeDefined();
        const condition = conditions.event!.conditions[0];
        expect(condition.attrs![0]).toMatchObject({
            key: 'name',
            type: 'string',
            value: 'log',
            operator: 'contains'
        });
    });

    test('parses condition with startsWith operator', () => {
        const cel = '(event_type == "custom" && custom.name.startsWith("log"))';
        const conditions = celToConditions(cel);

        expect(conditions.event).toBeDefined();
        const condition = conditions.event!.conditions[0];
        expect(condition.attrs![0]).toMatchObject({
            key: 'name',
            type: 'string',
            value: 'log',
            operator: 'startsWith'
        });
    });

    test('parses condition with numeric comparison operators', () => {
        const testCases = [
            { cel: '(event_type == "custom" && custom.retry_count >= 1)', operator: 'gte' },
            { cel: '(event_type == "custom" && custom.retry_count <= 1)', operator: 'lte' },
            { cel: '(event_type == "custom" && custom.retry_count < 1)', operator: 'lt' },
            { cel: '(event_type == "custom" && custom.retry_count > 1)', operator: 'gt' },
            { cel: '(event_type == "custom" && custom.retry_count != 1)', operator: 'neq' }
        ];

        testCases.forEach(({ cel, operator }) => {
            const conditions = celToConditions(cel);
            expect(conditions.event).toBeDefined();
            const condition = conditions.event!.conditions[0];
            expect(condition.attrs![0]).toMatchObject({
                key: 'retry_count',
                type: 'number',
                value: 1,
                operator
            });
        });
    });

    test('parses complex combined conditions', () => {
        const cel = '((event_type == "anr" && attribute.is_device_foldable == true) && (event_type == "exception")) && (span_name == "Activity TTID" && trace.user_defined_attrs.api_level >= 21)';
        const conditions = celToConditions(cel);

        // Event conditions
        expect(conditions.event).toBeDefined();
        expect(conditions.event!.conditions).toHaveLength(2);
        expect(conditions.event!.operators).toEqual(['AND']);
        expect(conditions.event!.conditions[0].type).toBe('anr');
        expect(conditions.event!.conditions[1].type).toBe('exception');

        // Trace conditions
        expect(conditions.trace).toBeDefined();
        expect(conditions.trace!.conditions).toHaveLength(1);
        expect(conditions.trace!.conditions[0].spanName).toBe('Activity TTID');
        expect(conditions.trace!.conditions[0].ud_attrs).toHaveLength(1);

        // Session conditions
        expect(conditions.event!.conditions[0].session_attrs[0]).toBeDefined();
        expect(conditions.event!.conditions[0].session_attrs[0].key).toBe('is_device_foldable');
    });

    test('parses condition with null value', () => {
        const cel = '(event_type == "custom" && custom.value == null)';
        const conditions = celToConditions(cel);

        expect(conditions.event).toBeDefined();
        const condition = conditions.event!.conditions[0];
        expect(condition.attrs![0]).toMatchObject({
            key: 'value',
            type: 'null',
            value: null,
            operator: 'eq'
        });
    });

    test('parses condition with string value', () => {
        const cel = '(event_type == "custom" && custom.message == "hello world")';
        const conditions = celToConditions(cel);

        expect(conditions.event).toBeDefined();
        const condition = conditions.event!.conditions[0];
        expect(condition.attrs![0]).toMatchObject({
            key: 'message',
            type: 'string',
            value: 'hello world',
            operator: 'eq'
        });
    });

    test('parses condition with number value', () => {
        const cel = '(event_type == "custom" && custom.count == 42)';
        const conditions = celToConditions(cel);

        expect(conditions.event).toBeDefined();
        const condition = conditions.event!.conditions[0];
        expect(condition.attrs![0]).toMatchObject({
            key: 'count',
            type: 'number',
            value: 42,
            operator: 'eq'
        });
    });

    test('handles whitespace in expression', () => {
        const cel = '  ( event_type  ==  "anr"  )  ';
        const conditions = celToConditions(cel);

        expect(conditions.event).toBeDefined();
        expect(conditions.event!.conditions[0].type).toBe('anr');
    });

    test('returns empty result for invalid expression', () => {
        const cel = 'invalid expression';
        const conditions = celToConditions(cel);

        expect(conditions).toEqual({});
    });

    test('returns empty result for malformed parentheses', () => {
        const cel = '(event_type == "anr"';
        const conditions = celToConditions(cel);

        expect(conditions).toEqual({});
    });
});