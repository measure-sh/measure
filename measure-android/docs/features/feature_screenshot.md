# Feature - Screenshot

Measure captures a screenshot of the app as soon as it crashes due to an unhandled exception or an
ANR. This screenshot is sent to the server as an [attachment](../../../docs/api/sdk/README.md#attachments) along with the crash report.

This feature is enabled by default and does not require any additional configuration.

## How it works

Screenshots are captured using [PixelCopy](https://developer.android.com/reference/android/view/PixelCopy) for Android
versions 8.0 and above. For devices running on Android versions below 8.0, the screenshot is captured by drawing the
root view of the app on a canvas and then converting it to a bitmap.

All screenshots are compressed
using [WebP](https://developer.android.com/reference/android/graphics/Bitmap.CompressFormat) format for
Android versions 11 and above. For devices running on Android versions below 11, the screenshots are compressed using
[JPEG](https://developer.android.com/reference/android/graphics/Bitmap.CompressFormat) format.

## Masking PII and Sensitive Data

Note that screenshots can leak sensitive information. To prevent this, Measure masks sensitive information in the
screenshot by default and provides a way to hide all text from the screenshots as well.

### Default Masking
By default, for View based UI, all input fields
with [inputType](https://developer.android.com/reference/android/text/InputType)
set to `textPassword`, `textVisiblePassword`, `textWebPassword`, `numberPassword`, `textEmailAddress`, `textEmail`
and `phone` are masked in the screenshot.

For compose based UI, all input fields with KeyboardOptions set
to `KeyboardOptions(keyboardType = KeyboardType.Password)`
are masked in the screenshot by default.

Do note that by default, all clickable views (like Buttons or TextViews with `clickable` set to `true`) are not masked
to provide context in the screenshot. This is currently not configurable.

### Mask all text
Optionally, all text can also be masked in the screenshot by enabling the `maskAllTextInScreenshot` config.

### Mask entire screen from screenshots
If these options do not satisfy your requirements, consider
using [FLAG_SECURE](https://developer.android.com/reference/android/view/WindowManager.LayoutParams#FLAG_SECURE) to hide
an entire screen with potential sensitive information from screenshots.
