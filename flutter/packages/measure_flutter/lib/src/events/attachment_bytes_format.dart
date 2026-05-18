/// Internal: describes how `MsrAttachment.bytes` is laid out.
enum AttachmentBytesFormat {
  /// Raw RGBA8888 pixel data. The buffer length equals `width * height * 4`.
  rawRgba8888,

  /// Bytes already in an encoded image container (PNG/JPEG/WebP/etc.).
  encoded,
}
