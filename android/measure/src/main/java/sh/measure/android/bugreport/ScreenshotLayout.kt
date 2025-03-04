package sh.measure.android.bugreport

import android.content.Context
import android.util.AttributeSet
import android.view.View
import android.widget.LinearLayout
import androidx.core.view.children
import sh.measure.android.R

internal class ScreenshotLayout @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : LinearLayout(context, attrs, defStyleAttr) {
    private val spacing = context.resources.getDimensionPixelSize(R.dimen.msr_screenshot_spacing)

    init {
        orientation = HORIZONTAL
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        super.onMeasure(widthMeasureSpec, heightMeasureSpec)
        val totalSpacing = (childCount - 1) * spacing
        // Add extra spacing for left and right margins
        setMeasuredDimension(
            measuredWidth + totalSpacing + (spacing * 2),
            measuredHeight,
        )
    }

    override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
        var currentLeft = paddingLeft
        val centerVertical = paddingTop + (height - paddingTop - paddingBottom) / 2

        children.forEach { child ->
            if (child.visibility != View.GONE) {
                val childWidth = child.measuredWidth
                val childHeight = child.measuredHeight

                val childTop = centerVertical - childHeight / 2
                child.layout(
                    currentLeft,
                    childTop,
                    currentLeft + childWidth,
                    childTop + childHeight,
                )

                currentLeft += childWidth + spacing
            }
        }
    }
}
