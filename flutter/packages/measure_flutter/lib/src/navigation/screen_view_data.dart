import 'package:json_annotation/json_annotation.dart';

import '../serialization/json_serializable.dart';

part 'screen_view_data.g.dart';

@JsonSerializable(explicitToJson: true)
class ScreenViewData implements JsonSerialized {
  final String name;

  const ScreenViewData({
    required this.name,
  });

  @override
  Map<String, dynamic> toJson() => _$ScreenViewDataToJson(this);

  factory ScreenViewData.fromJson(Map<String, dynamic> json) =>
      _$ScreenViewDataFromJson(json);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ScreenViewData &&
          runtimeType == other.runtimeType &&
          name == other.name;

  @override
  int get hashCode => name.hashCode;
}
