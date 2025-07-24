package sh.measure.android.utils

import android.text.InputType
import android.view.inputmethod.EditorInfo
import android.widget.TextView

/**
 * Returns true if the input type of this [TextView] is sensitive.
 * This includes password, email, and phone input types.
 *
 * @return true if the input type of this [TextView] is sensitive.
 */
internal fun TextView.isSensitiveInputType(): Boolean = isPasswordInputType() || isVisiblePasswordInputType() || isEmailInputType() || isPhoneInputType()

private fun TextView.isEmailInputType(): Boolean = inputType == InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS

private fun TextView.isPhoneInputType(): Boolean = inputType == InputType.TYPE_CLASS_TEXT or InputType.TYPE_CLASS_PHONE

// Copied from [TextView.isPasswordInputType] as it is hidden from public API.
private fun TextView.isPasswordInputType(): Boolean {
    val variation = inputType and (EditorInfo.TYPE_MASK_CLASS or EditorInfo.TYPE_MASK_VARIATION)
    return variation == EditorInfo.TYPE_CLASS_TEXT or EditorInfo.TYPE_TEXT_VARIATION_PASSWORD || variation == EditorInfo.TYPE_CLASS_TEXT or EditorInfo.TYPE_TEXT_VARIATION_WEB_PASSWORD || variation == EditorInfo.TYPE_CLASS_NUMBER or EditorInfo.TYPE_NUMBER_VARIATION_PASSWORD
}

private fun TextView.isVisiblePasswordInputType(): Boolean {
    val variation = inputType and (EditorInfo.TYPE_MASK_CLASS or EditorInfo.TYPE_MASK_VARIATION)
    return variation == EditorInfo.TYPE_CLASS_TEXT or EditorInfo.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
}
