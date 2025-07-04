import 'dart:convert';

import 'package:measure_flutter/measure.dart';

extension AttachmentEncoding on List<MsrAttachment> {
  List<Map<String, dynamic>> toJsonList() {
    return map((attachment) => attachment.toJson()).toList();
  }

  String encode() {
    return jsonEncode(toJsonList());
  }
}
