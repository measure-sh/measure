import 'package:flutter/material.dart';

import '../../../measure.dart';

class ScreenshotsState extends ChangeNotifier {
  final List<MsrAttachment> _screenshots = [];

  List<MsrAttachment> get screenshots => List.unmodifiable(_screenshots);

  bool get hasScreenshots => _screenshots.isNotEmpty;

  void addScreenshot(MsrAttachment screenshot) {
    _screenshots.add(screenshot);
    _safeNotifyListeners();
  }

  void addScreenshots(List<MsrAttachment> screenshot) {
    _screenshots.addAll(screenshot);
    _safeNotifyListeners();
  }

  void removeScreenshot(int index) {
    if (index >= 0 && index < _screenshots.length) {
      _screenshots.removeAt(index);
      _safeNotifyListeners();
    }
  }

  void clearScreenshots() {
    _screenshots.clear();
    _safeNotifyListeners();
  }

  void initializeWithScreenshot(MsrAttachment? initialScreenshot) {
    if (initialScreenshot != null) {
      _screenshots.add(initialScreenshot);
      _safeNotifyListeners();
    }
  }

  void _safeNotifyListeners() {
    if (hasListeners) {
      notifyListeners();
    }
  }
}
