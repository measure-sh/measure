import 'package:json_annotation/json_annotation.dart';

enum ScreenshotMaskLevel {
  @JsonValue('all_text_and_media')
  allTextAndMedia,
  @JsonValue('all_text')
  allText,
  @JsonValue('none')
  none,
}
