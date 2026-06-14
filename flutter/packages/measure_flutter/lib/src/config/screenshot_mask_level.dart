import 'package:json_annotation/json_annotation.dart';

enum ScreenshotMaskLevel {
  /// Masks all text, input fields, images and videos.
  @JsonValue('all_text_and_media')
  allTextAndMedia,

  /// Masks all text and input fields, including clickable elements.
  @JsonValue('all_text')
  allText,

  /// Masks all text and input fields, excluding clickable elements.
  @JsonValue('all_text_except_clickable')
  allTextExceptClickable,

  /// Masks only sensitive input fields like passwords, email and phone fields.
  @JsonValue('sensitive_fields_only')
  sensitiveFieldsOnly,
}
