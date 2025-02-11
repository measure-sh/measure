
import 'measure_flutter_platform_interface.dart';

class MeasureFlutter {
  Future<String?> getPlatformVersion() {
    return MeasureFlutterPlatform.instance.getPlatformVersion();
  }
}
