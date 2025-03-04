package sh.measure.android.bugreport

import android.content.Context
import android.net.Uri
import android.util.AttributeSet
import android.view.View
import android.view.animation.DecelerateInterpolator
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.ImageView
import sh.measure.android.R
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

internal class ScreenshotView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
    defStyleRes: Int = 0,
) : FrameLayout(context, attrs, defStyleAttr, defStyleRes) {
    private val imageExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private val imageView: ImageView
    private val closeButton: ImageButton
    private var removeListener: (() -> Unit)? = null

    init {
        inflate(context, R.layout.msr_screenshot, this)
        imageView = findViewById(R.id.imageView)
        closeButton = findViewById(R.id.closeButton)
        closeButton.setOnClickListener {
            removeListener?.invoke()
        }
    }

    fun setImageFromPath(path: String) {
        setInitialStateBeforeAnimation()
        ImageLoader.loadImageFromFile(imageView, path, ::animateAppearance)
    }

    fun setImageFromUri(uri: Uri) {
        setInitialStateBeforeAnimation()
        ImageLoader.loadImageFromUri(imageView, uri, ::animateAppearance)
    }

    fun setRemoveClickListener(removeListener: () -> Unit) {
        this.removeListener = removeListener
    }

    override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
        super.onLayout(changed, left, top, right, bottom)
        val imageRight = imageView.right
        val imageTop = imageView.top
        val buttonSize = closeButton.width

        closeButton.layout(
            imageRight - buttonSize / 2,
            imageTop - buttonSize / 2,
            imageRight + buttonSize / 2,
            imageTop + buttonSize / 2,
        )
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        imageExecutor.shutdown()
        removeListener = null
    }

    private fun setInitialStateBeforeAnimation() {
        alpha = 0f
        scaleX = 0.95f
        scaleY = 0.95f
    }

    private fun animateAppearance() {
        closeButton.visibility = View.VISIBLE
        animate()
            .setStartDelay(150)
            .alpha(1f)
            .scaleX(1f)
            .scaleY(1f)
            .setDuration(300)
            .setInterpolator(DecelerateInterpolator())
            .start()
    }
}
