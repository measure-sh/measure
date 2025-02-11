import 'package:flutter_test/flutter_test.dart';
import 'package:measure_flutter/src/measure_flutter_method_channel.dart';
import 'package:measure_flutter/src/measure_flutter_platform_interface.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';

class MockMeasureFlutterPlatform
    with MockPlatformInterfaceMixin
    implements MeasureFlutterPlatform {
  @override
  Future<String?> getPlatformVersion() => Future.value('42');
}

void main() {
  final MeasureFlutterPlatform initialPlatform =
      MeasureFlutterPlatform.instance;

  test('$MethodChannelMeasureFlutter is the default instance', () {
    expect(initialPlatform, isInstanceOf<MethodChannelMeasureFlutter>());
  });

  // test('getPlatformVersion', () async {
  //   MeasureSdk measureFlutterPlugin = MeasureSdk.instance;
  //   MockMeasureFlutterPlatform fakePlatform = MockMeasureFlutterPlatform();
  //   MeasureFlutterPlatform.instance = fakePlatform;
  //
  //   expect(await measureFlutterPlugin.getPlatformVersion(), '42');
  // });
}
