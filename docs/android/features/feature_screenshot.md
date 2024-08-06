# Feature - Screenshot

Measure captures a screenshot of the app as soon as it crashes due to an unhandled exception or an
ANR. This screenshot is sent to the server as an [attachment](../../api/sdk/README.md#attachments) along with
the crash report.

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

Note that screenshots can leak sensitive information. To prevent this, Measure masks all text and media from screenshots
by default. Masking levels can be configured to suit your requirements.

To configure the masking level, use the `screenshotMaskLevel` configuration option. See
the [configurations](../configuration-options.md#screenshotmasklevel) doc for all the options available.
