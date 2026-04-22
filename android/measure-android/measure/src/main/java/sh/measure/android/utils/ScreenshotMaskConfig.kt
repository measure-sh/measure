package sh.measure.android.utils

import android.graphics.Rect
import android.view.View

internal data class ScreenshotMaskConfig(
    val maskHexColor: String,
    val getMaskRects: (View) -> List<Rect>,
)
