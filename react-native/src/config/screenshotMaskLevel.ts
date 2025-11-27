/**
 * The level of masking to apply to the screenshot.
 */
export enum ScreenshotMaskLevel {
  /**
   * The strictest level of masking which masks all text,
   * input fields, images, and videos.
   */
  allTextAndMedia = "AllTextAndMedia",

  /**
   * Masks all text and input fields, including clickable elements.
   */
  allText = "AllText",

  /**
   * Masks all text and input fields, excluding clickable elements.
   */
  allTextExceptClickable = "AllTextExceptClickable",

  /**
   * The most lenient masking level which only masks sensitive input fields
   * like passwords, email fields, and phone number fields.
   */
  sensitiveFieldsOnly = "SensitiveFieldsOnly"
}