package sh.measure.android.config

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * The level of masking to apply to the screenshot.
 */
@Serializable
internal enum class ScreenshotMaskLevel {
    /**
     * The strictest level of masking which masks all text, input fields, images and videos.
     */
    @SerialName("all_text_and_media")
    AllTextAndMedia,

    /**
     * Masks all text and input fields, including clickable elements.
     */
    @SerialName("all_text")
    AllText,

    /**
     * Masks all text and input fields, excluding clickable elements.
     */
    @SerialName("all_text_except_clickable")
    AllTextExceptClickable,

    /**
     * The most lenient level of masking which only masks sensitive input fields like passwords,
     * email and phone number fields.
     */
    @Suppress("unused")
    @SerialName("sensitive_fields_only")
    SensitiveFieldsOnly,
}
