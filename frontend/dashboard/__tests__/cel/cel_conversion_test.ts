import { conditionsToCel } from "@/app/utils/cel/cel_generator";
import { celToConditions } from "@/app/utils/cel/cel_parser";

describe('CEL to conditions and back to CEL', () => {

    test('processes a single event condition', () => {
        const cel = '(event_type == "anr")';
        const conditions = celToConditions(cel);
        const outputCel = conditionsToCel({ event: conditions.event, trace: undefined, session: undefined });
        expect(outputCel).toBe(cel);
    });

    test('processes multiple event conditions with AND operator', () => {
        const cel = '((event_type == "anr") && (event_type == "exception"))';
        const conditions = celToConditions(cel);
        const outputCel = conditionsToCel({ event: conditions.event, trace: undefined, session: undefined });
        expect(outputCel).toBe(cel);
    });

    test('processes multiple event conditions with OR operator', () => {
        const cel = '((event_type == "anr") || (event_type == "exception"))';
        const conditions = celToConditions(cel);
        const outputCel = conditionsToCel({ event: conditions.event, trace: undefined, session: undefined });
        expect(outputCel).toBe(cel);
    });

    test('processes event with attribute', () => {
        const cel = '(event_type == "exception" && exception.handled == false)';
        const conditions = celToConditions(cel);
        const outputCel = conditionsToCel({ event: conditions.event, trace: undefined, session: undefined });
        expect(outputCel).toBe(cel);
    });

    test('processes event with attribute and ud-attribute', () => {
        const cel = '(event_type == "custom" && custom.name == "login" && event.user_defined_attrs.is_premium_user == true)';
        const conditions = celToConditions(cel);
        const outputCel = conditionsToCel({ event: conditions.event, trace: undefined, session: undefined });
        expect(outputCel).toBe(cel);
    });

    test('processes event with ud-attribute', () => {
        const cel = '(event_type == "custom" && event.user_defined_attrs.is_premium_user == true)';
        const conditions = celToConditions(cel);
        const outputCel = conditionsToCel({ event: conditions.event, trace: undefined, session: undefined });
        expect(outputCel).toBe(cel);
    });

    test('processes session attribute only', () => {
        const cel = '(attribute.is_device_foldable == true)';
        const conditions = celToConditions(cel);
        const outputCel = conditionsToCel({ event: undefined, trace: undefined, session: conditions.session, });
        expect(outputCel).toBe(cel);
    });

    test('processes multiple session attributes with AND operator', () => {
        const cel = '((attribute.is_device_foldable == true) && (attribute.app_version == "1.0.0"))';
        const conditions = celToConditions(cel);
        const outputCel = conditionsToCel({ event: undefined, trace: undefined, session: conditions.session, });
        expect(outputCel).toBe(cel);
    });

    test('processes multiple session attributes with OR operator', () => {
        const cel = '((attribute.is_device_foldable == true) || (attribute.app_version == "1.0.0"))';
        const conditions = celToConditions(cel);
        const outputCel = conditionsToCel({ event: undefined, trace: undefined, session: conditions.session, });
        expect(outputCel).toBe(cel);
    });

    test('processes combined event and session conditions', () => {
        const cel = '(event_type == "anr") && (attribute.is_device_foldable == true)';
        const conditions = celToConditions(cel);
        const outputCel = conditionsToCel({ event: conditions.event, trace: undefined, session: conditions.session });
        expect(outputCel).toBe(cel);
    });

    test('processes condition with contains operator', () => {
        const cel = '(event_type == "custom" && custom.name.contains("log"))';
        const conditions = celToConditions(cel);
        const outputCel = conditionsToCel({ event: conditions.event, trace: undefined, session: undefined });
        expect(outputCel).toBe(cel);
    });

    test('processes condition with startsWith operator', () => {
        const cel = '(event_type == "custom" && custom.name.startsWith("log"))';
        const conditions = celToConditions(cel);
        const outputCel = conditionsToCel({ event: conditions.event, trace: undefined, session: undefined });
        expect(outputCel).toBe(cel);
    });

    test('processes condition with gte operator', () => {
        const cel = '(event_type == "custom" && custom.retry_cound >= 1)';
        const conditions = celToConditions(cel);
        const outputCel = conditionsToCel({ event: conditions.event, trace: undefined, session: undefined });
        expect(outputCel).toBe(cel);
    });

    test('processes condition with lte operator', () => {
        const cel = '(event_type == "custom" && custom.retry_cound <= 1)';
        const conditions = celToConditions(cel);
        const outputCel = conditionsToCel({ event: conditions.event, trace: undefined, session: undefined });
        expect(outputCel).toBe(cel);
    });

    test('processes condition with lt operator', () => {
        const cel = '(event_type == "custom" && custom.retry_cound < 1)';
        const conditions = celToConditions(cel);
        const outputCel = conditionsToCel({ event: conditions.event, trace: undefined, session: undefined });
        expect(outputCel).toBe(cel);
    });

    test('processes condition with gt operator', () => {
        const cel = '(event_type == "custom" && custom.retry_cound > 1)';
        const conditions = celToConditions(cel);
        const outputCel = conditionsToCel({ event: conditions.event, trace: undefined, session: undefined });
        expect(outputCel).toBe(cel);
    });

    test('processes a span condition', () => {
        const cel = '(span_name == "Activity TTID")';
        const conditions = celToConditions(cel);
        const outputCel = conditionsToCel({ event: undefined, trace: conditions.trace , session: undefined });
        expect(outputCel).toBe(cel);
    });

    test('processes multiple span conditions with AND operator', () => {
        const cel = '((span_name == "Activity TTID") && (span_name.startsWith("HTTP GET /config")))';
        const conditions = celToConditions(cel);
        const outputCel = conditionsToCel({ event: undefined, trace: conditions.trace , session: undefined });
        expect(outputCel).toBe(cel);
    });

    test('processes multiple span conditions with OR operator', () => {
        const cel = '((span_name == "Activity TTID") || (span_name.startsWith("HTTP GET /config")))';
        const conditions = celToConditions(cel);
        const outputCel = conditionsToCel({ event: undefined, trace: conditions.trace , session: undefined });
        expect(outputCel).toBe(cel);
    });

    test('processes a span condition with user defined attributes', () => {
        const cel = '(span_name == "Activity TTID" && trace.user_defined_attrs.api_level >= 21)';
        const conditions = celToConditions(cel);

        expect(conditions.trace).toBeDefined();

        const outputCel = conditionsToCel({ event: undefined, trace: conditions.trace , session: undefined });
        expect(outputCel).toBe(cel);
    });

    test('processes a span condition with session conditions', () => {
        const cel = '(span_name == "Activity TTID") && (attribute.is_device_foldable == true)';
        const conditions = celToConditions(cel);
        const outputCel = conditionsToCel({ event: undefined, trace: conditions.trace, session: conditions.session });
        expect(outputCel).toBe(cel);
    });

    test('processes complex combined conditions', () => {
        const cel = '((event_type == "anr") && (event_type == "exception")) && (span_name == "Activity TTID" && trace.user_defined_attrs.api_level >= 21) && (attribute.is_device_foldable == true)';
        const conditions = celToConditions(cel);
        const outputCel = conditionsToCel({ event: conditions.event, trace: conditions.trace, session: conditions.session });
        expect(outputCel).toBe(cel);
    });
});
