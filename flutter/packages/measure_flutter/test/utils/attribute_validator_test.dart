import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter/src/utils/attribute_validator.dart';

import 'fake_config_provider.dart';
import 'noop_logger.dart';

void main() {
  late FakeConfigProvider configProvider;

  setUp(() {
    configProvider = FakeConfigProvider();
  });

  group('isValidAttributeKey', () {
    test('accepts alphabets, numbers, hyphens and underscores', () {
      expect(isValidAttributeKey('valid_key-123', configProvider), isTrue);
    });

    test('rejects keys with other characters', () {
      expect(isValidAttributeKey('bad key!', configProvider), isFalse);
      expect(isValidAttributeKey('dotted.key', configProvider), isFalse);
    });

    test('rejects an empty key', () {
      expect(isValidAttributeKey('', configProvider), isFalse);
    });

    test('rejects keys over the maximum length', () {
      final max = configProvider.maxUserDefinedAttributeKeyLength;
      expect(isValidAttributeKey('k' * max, configProvider), isTrue);
      expect(isValidAttributeKey('k' * (max + 1), configProvider), isFalse);
    });
  });

  group('isValidAttributeValue', () {
    test('rejects string values over the maximum length', () {
      final max = configProvider.maxUserDefinedAttributeValueLength;
      expect(isValidAttributeValue(StringAttr('v' * max), configProvider), isTrue);
      expect(isValidAttributeValue(StringAttr('v' * (max + 1)), configProvider), isFalse);
    });

    test('checks raw span values', () {
      final max = configProvider.maxUserDefinedAttributeValueLength;
      expect(isValidAttributeValue('v' * (max + 1), configProvider), isFalse);
      expect(isValidAttributeValue(1, configProvider), isTrue);
      expect(isValidAttributeValue(true, configProvider), isTrue);
    });
  });

  group('dropInvalidAttributes', () {
    test('keeps valid attributes and drops invalid ones', () {
      final result = dropInvalidAttributes(
        'event',
        <String, AttributeValue>{
          'valid_key': StringAttr('value'),
          'bad key!': StringAttr('value'),
          'long_value': StringAttr(
              'v' * (configProvider.maxUserDefinedAttributeValueLength + 1)),
          'number': IntAttr(1),
        },
        configProvider,
        NoopLogger(),
      );

      expect(result.keys, equals(['valid_key', 'number']));
    });

    test('keeps at most the maximum number of attributes', () {
      configProvider.maxUserDefinedAttributesPerEvent = 2;

      final result = dropInvalidAttributes(
        'event',
        {'a': 1, 'b': 2, 'c': 3},
        configProvider,
        NoopLogger(),
      );

      expect(result.keys, equals(['a', 'b']));
    });
  });
}
