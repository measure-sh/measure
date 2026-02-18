/**
 * The level of masking to apply to the screenshot.
 */
export enum ScreenshotMaskLevel {
  /**
   * The strictest level of masking which masks all text,
   * input fields, images, and videos.
   */
  allTextAndMedia = "all_text_and_media",

  /**
   * Masks all text and input fields, including clickable elements.
   */
  allText = "all_text",

  /**
   * Masks all text and input fields, excluding clickable elements.
   */
  allTextExceptClickable = "all_text_except_clickable",

  /**
   * The most lenient masking level which only masks sensitive input fields
   * like passwords, email fields, and phone number fields.
   */
  sensitiveFieldsOnly = "sensitive_fields_only"
}