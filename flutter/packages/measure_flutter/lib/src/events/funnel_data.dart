import 'package:json_annotation/json_annotation.dart';

import '../serialization/json_serializable.dart';

part 'funnel_data.g.dart';

@JsonSerializable(explicitToJson: true)
class FunnelData implements JsonSerialized {
  final String name;

  const FunnelData({
    required this.name,
  });

  @override
  Map<String, dynamic> toJson() => _$FunnelDataToJson(this);

  factory FunnelData.fromJson(Map<String, dynamic> json) =>
      _$FunnelDataFromJson(json);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is FunnelData &&
          runtimeType == other.runtimeType &&
          name == other.name;

  @override
  int get hashCode => name.hashCode;
}
