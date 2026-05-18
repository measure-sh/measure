package sh.measure.android.bugreport

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.widget.ImageView
import sh.measure.android.tracing.InternalTrace

/**
 * Handles image loading with memory-efficient scaling to prevent OutOfMemoryErrors
 * when dealing with large images in Android's limited memory environment.
 */
internal object ImageLoader {
    /**
     * Loads and scales an image from the file system into an ImageView.
     *
     * This function handles the common issue of loading images that are larger than
     * the available display area. Instead of loading the full-size image (which would
     * waste memory), it scales the image to match the ImageView's dimensions.
     *
     * If the ImageView's dimensions aren't yet available (common during initial layout),
     * the load is deferred until layout is complete.
     *
     * @param imageView Target view where the scaled image will be displayed
     * @param filePath Path to the image file in the file system
     * @param onLoadedListener Callback invoked when the image is successfully loaded
     */
    fun loadImageFromFile(imageView: ImageView, filePath: String, onLoadedListener: () -> Unit) {
        InternalTrace.trace(
            label = {
                "msr-loadImageFromFile"
            },
            block = {
                val availableWidth = imageView.width
                val availableHeight = imageView.height

                if (availableWidth <= 0 || availableHeight <= 0) {
                    imageView.post {
                        loadImageFromFile(imageView, filePath, onLoadedListener)
                    }
                    return@trace
                }
                val options = getBitmapBounds {
                    BitmapFactory.decodeFile(filePath, it)
                }
                val scaleFactor = calculateScaleFactor(
                    options.outWidth,
                    options.outHeight,
                    availableWidth,
                    availableHeight,
                )
                val bitmap = loadScaledBitmap(filePath, scaleFactor)
                bitmap?.let {
                    imageView.setImageBitmap(it)
                    onLoadedListener()
                }
            },
        )
    }

    /**
     * Loads and scales an image from a content Uri into an ImageView.
     *
     * Similar to [loadImageFromFile], but handles Android's content Uri system which is
     * necessary when loading images from other apps or the system (like gallery picker).
     *
     * The scaling logic is identical to file loading, but uses contentResolver to
     * access the image data since direct file system access isn't possible with Uris.
     *
     * @param imageView Target view where the scaled image will be displayed
     * @param uri Content Uri pointing to the image
     * @param onLoadedListener Callback invoked when the image is successfully loaded
     */
    fun loadImageFromUri(imageView: ImageView, uri: Uri, onLoadedListener: () -> Unit) {
        InternalTrace.trace(
            label = {
                "msr-loadImageFromUri"
            },
            block = {
                val availableWidth = imageView.width
                val availableHeight = imageView.height
                if (availableWidth <= 0 || availableHeight <= 0) {
                    imageView.post {
                        loadImageFromUri(imageView, uri, onLoadedListener)
                    }
                    return@trace
                }
                val options = getBitmapBounds { options ->
                    imageView.context.contentResolver.openInputStream(uri)?.use { input ->
                        BitmapFactory.decodeStream(input, null, options)
                    }
                }
                val scaleFactor = calculateScaleFactor(
                    options.outWidth,
                    options.outHeight,
                    availableWidth,
                    availableHeight,
                )
                val bitmap = imageView.context.contentResolver.openInputStream(uri)?.use { input ->
                    BitmapFactory.Options().run {
                        inSampleSize = scaleFactor
                        BitmapFactory.decodeStream(input, null, this)
                    }
                }
                bitmap?.let {
                    imageView.setImageBitmap(it)
                    onLoadedListener()
                }
            },
        )
    }

    /**
     * Efficiently determines the dimensions of a bitmap without loading it into memory.
     * BitmapFactory.Options allows us to decode just the bounds without the pixel data.
     */
    private fun getBitmapBounds(decoder: (BitmapFactory.Options) -> Unit): BitmapFactory.Options = BitmapFactory.Options().apply {
        inJustDecodeBounds = true
        decoder(this)
    }

    /**
     * Calculates how much to scale down an image based on the target view size.
     *
     * The scaling logic prioritizes memory efficiency while maintaining image quality:
     * - Scales down if the image is larger than the view
     * - Never scales up (returns 1 for smaller images)
     * - Caps maximum scale factor at 4 to preserve image quality
     * - Uses the most conservative scale factor between width and height to maintain aspect ratio
     *
     * Examples:
     * - 4000x3000 image into 1000x750 view returns 4.
     * - 1600x1200 image into 800x600 view returns 2.
     */
    private fun calculateScaleFactor(
        imageWidth: Int,
        imageHeight: Int,
        availableWidth: Int,
        availableHeight: Int,
    ): Int = maxOf(1, minOf(imageWidth / availableWidth, imageHeight / availableHeight, 4))

    /**
     * Loads a bitmap with the calculated scaling factor applied.
     */
    private fun loadScaledBitmap(filePath: String, scalingFactor: Int): Bitmap? = BitmapFactory.Options().run {
        inSampleSize = scalingFactor
        BitmapFactory.decodeFile(filePath, this)
    }
}
