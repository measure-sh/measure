package sh.measure.android.config

/**
 * The level of masking to apply to the screenshot.
 */
enum class ScreenshotMaskLevel {
    /**
     * The strictest level of masking which masks all text, input fields, images and videos.
     */
    AllTextAndMedia,

    /**
     * Masks all text and input fields, including clickable elements.
     */
    AllText,

    /**
     * Masks all text and input fields, excluding clickable elements.
     */
    AllTextExceptClickable,

    /**
     * The most lenient level of masking which only masks sensitive input fields like passwords,
     * email and phone number fields.
     */
    @Suppress("unused")
    SensitiveFieldsOnly,
}
