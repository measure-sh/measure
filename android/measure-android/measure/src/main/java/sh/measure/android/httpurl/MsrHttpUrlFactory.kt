package sh.measure.android.httpurl

import sh.measure.android.Measure
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLConnection
import javax.net.ssl.HttpsURLConnection

/**
 * Public entry point that the Gradle plugin's bytecode rewrite calls into.
 *
 * After every `URL.openConnection()` / `URL.openConnection(Proxy)` callsite, the
 * plugin emits an `INVOKESTATIC` to [wrap], replacing the returned
 * [URLConnection] with one of the Measure wrappers.
 *
 * `URL.openStream()` callsites are rewritten to call [openStream] directly so
 * we capture the implicit `openConnection().getInputStream()` chain too.
 *
 * Changing this API may break the bytecode rewrite.
 */
object MsrHttpUrlFactory {
    @JvmStatic
    fun wrap(connection: URLConnection?): URLConnection? {
        if (connection == null) return null
        // Don't double-wrap if we somehow encounter our own wrapper.
        if (connection is MsrHttpURLConnection || connection is MsrHttpsURLConnection) {
            return connection
        }
        val collector = Measure.getHttpUrlConnectionEventCollector() ?: return connection
        if (!collector.isEnabled()) return connection

        val url = try {
            connection.url.toString()
        } catch (e: Throwable) {
            return connection
        }
        val recorder = collector.newRecorder(url)
        if (!recorder.isTracked()) return connection

        return when (connection) {
            is HttpsURLConnection -> MsrHttpsURLConnection(connection, recorder)
            is HttpURLConnection -> MsrHttpURLConnection(connection, recorder)
            else -> connection
        }
    }

    @JvmStatic
    fun openStream(url: URL): InputStream {
        val wrapped = wrap(url.openConnection()) ?: return url.openStream()
        return wrapped.getInputStream()
    }
}
