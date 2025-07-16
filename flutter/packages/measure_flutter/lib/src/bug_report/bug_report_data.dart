import 'package:json_annotation/json_annotation.dart';
import 'package:measure_flutter/src/serialization/json_serializable.dart';

part 'bug_report_data.g.dart';

@JsonSerializable()
class BugReportData implements JsonSerialized {
  final String description;

  BugReportData({required this.description});

  @override
  Map<String, dynamic> toJson() => _$BugReportDataToJson(this);

  factory BugReportData.fromJson(Map<String, dynamic> json) =>
      _$BugReportDataFromJson(json);
}
