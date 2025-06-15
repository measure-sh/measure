import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/src/utils/id_provider.dart';

void main() {
  group('IdProviderImpl', () {
    late IdProviderImpl idProvider;

    setUp(() {
      idProvider = IdProviderImpl();
    });

    test('spanId generates valid 16-character hex string', () {
      final spanId = idProvider.spanId();
      
      expect(spanId, hasLength(16));
      expect(spanId, matches(RegExp(r'^[0-9a-f]{16}$')));
      expect(spanId, isNot(equals('0000000000000000')));
    });

    test('traceId generates valid 32-character hex string', () {
      final traceId = idProvider.traceId();
      
      expect(traceId, hasLength(32));
      expect(traceId, matches(RegExp(r'^[0-9a-f]{32}$')));
      expect(traceId, isNot(equals('00000000000000000000000000000000')));
    });

    test('spanId generates unique values', () {
      final spanIds = <String>{};
      
      for (int i = 0; i < 100; i++) {
        spanIds.add(idProvider.spanId());
      }
      
      expect(spanIds, hasLength(100));
    });

    test('traceId generates unique values', () {
      final traceIds = <String>{};
      
      for (int i = 0; i < 100; i++) {
        traceIds.add(idProvider.traceId());
      }
      
      expect(traceIds, hasLength(100));
    });

    test('spanId never returns all zeros', () {
      // Test multiple times to ensure it's never all zeros
      for (int i = 0; i < 50; i++) {
        final spanId = idProvider.spanId();
        expect(spanId, isNot(equals('0000000000000000')));
      }
    });

    test('traceId never has all zeros in low part', () {
      // Test multiple times to ensure low part is never all zeros
      for (int i = 0; i < 50; i++) {
        final traceId = idProvider.traceId();
        final lowPart = traceId.substring(16);
        expect(lowPart, isNot(equals('0000000000000000')));
      }
    });
  });
}