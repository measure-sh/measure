/**
 * The level of masking to apply to the screenshot.
 */
export enum ScreenshotMaskLevel {
  /**
   * The strictest level of masking which masks all text,
   * input fields, images, and videos.
   */
  allTextAndMedia = "allTextAndMedia",

  /**
   * Masks all text and input fields, including clickable elements.
   */
  allText = "allText",

  /**
   * Masks all text and input fields, excluding clickable elements.
   */
  allTextExceptClickable = "allTextExceptClickable",

  /**
   * The most lenient masking level which only masks sensitive input fields
   * like passwords, email fields, and phone number fields.
   */
  sensitiveFieldsOnly = "sensitiveFieldsOnly"
}