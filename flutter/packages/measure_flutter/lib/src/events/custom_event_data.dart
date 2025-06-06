import 'package:json_annotation/json_annotation.dart';

import '../serialization/json_serializable.dart';

part 'custom_event_data.g.dart';

@JsonSerializable()
class CustomEventData implements JsonSerialized {
  final String name;

  CustomEventData({required this.name});

  @override
  Map<String, dynamic> toJson() => _$CustomEventDataToJson(this);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is CustomEventData &&
          runtimeType == other.runtimeType &&
          name == other.name;

  @override
  int get hashCode => name.hashCode;
}
