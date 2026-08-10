import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/src/utils/file_extension.dart';

void main() {
  group('fileExtensionOf', () {
    test('returns the extension without the leading dot', () {
      expect(fileExtensionOf('screenshot.webp'), equals('webp'));
    });

    test('returns the last segment of a double extension', () {
      expect(fileExtensionOf('snapshot.json.gz'), equals('gz'));
    });

    test('returns empty when there is no dot', () {
      expect(fileExtensionOf('0191f3f9-8e0a-7000-8000-000000000000'),
          equals(''));
    });

    test('returns empty for a dotfile', () {
      expect(fileExtensionOf('.gitignore'), equals(''));
    });

    test('returns empty for a trailing dot', () {
      expect(fileExtensionOf('screenshot.'), equals(''));
    });

    test('returns empty when only a directory segment has a dot', () {
      expect(fileExtensionOf('/tmp/my.dir/screenshot'), equals(''));
    });

    test('reads the extension off a full path', () {
      expect(fileExtensionOf('/tmp/my.dir/screenshot.jpg'), equals('jpg'));
    });

    test('handles windows separators', () {
      expect(fileExtensionOf(r'C:\images\screenshot.png'), equals('png'));
    });

    test('returns empty for an empty string', () {
      expect(fileExtensionOf(''), equals(''));
    });
  });
}
