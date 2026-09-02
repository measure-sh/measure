package sh.frankenstein.android

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect

private const val MEDIA_PIXELS = 2 * 1024 * 1024
private const val EXPORT_BYTES = 8 * 1024 * 1024

object ScreenMedia {
    private var pass = 0

    var enabled: Boolean = false

    fun prepare(screenName: String) {
        if (!enabled) return
        pass++
        when (pass % 3) {
            0 -> HeroImageDecoder.decode(screenName)
            1 -> SharePreviewRenderer.render(screenName)
            else -> ExportPayloadWriter.write(screenName)
        }
    }
}

@Composable
fun ScreenMediaEffect(screenName: String) {
    LaunchedEffect(screenName) {
        ScreenMedia.prepare(screenName)
    }
}

private object HeroImageDecoder {
    fun decode(screenName: String): Int {
        val pixels = IntArray(MEDIA_PIXELS)
        return fingerprint(pixels, screenName)
    }
}

private object SharePreviewRenderer {
    fun render(screenName: String): Int {
        val pixels = IntArray(MEDIA_PIXELS)
        return fingerprint(pixels, screenName)
    }
}

private object ExportPayloadWriter {
    fun write(screenName: String): Int {
        val payload = ByteArray(EXPORT_BYTES)
        var hash = screenName.hashCode()
        var index = 0
        while (index < payload.size) {
            payload[index] = hash.toByte()
            hash = hash * 31 + index
            index += 4096
        }
        return hash
    }
}

private fun fingerprint(pixels: IntArray, screenName: String): Int {
    var hash = screenName.hashCode()
    var index = 0
    while (index < pixels.size) {
        pixels[index] = hash
        hash = hash * 31 + index
        index += 1024
    }
    return hash
}
