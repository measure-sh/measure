import 'package:json_annotation/json_annotation.dart';

import '../serialization/json_serializable.dart';

part 'log_data.g.dart';

@JsonSerializable()
class LogData implements JsonSerialized {
  @JsonKey(name: "severity_text")
  final String severityText;
  @JsonKey(name: "severity_number")
  final int severityNumber;
  final String body;

  LogData({
    required this.severityText,
    required this.severityNumber,
    required this.body,
  });

  @override
  Map<String, dynamic> toJson() => _$LogDataToJson(this);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is LogData &&
          runtimeType == other.runtimeType &&
          severityText == other.severityText &&
          severityNumber == other.severityNumber &&
          body == other.body;

  @override
  int get hashCode => Object.hash(severityText, severityNumber, body);
}
