package sh.measure.android.exporter

import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.MalformedURLException
import java.net.URL


internal interface HttpClient {
    fun sendMultipartRequest(
        url: String,
        method: String,
        headers: Map<String, String>,
        multipartData: List<MultipartData>,
    ): HttpResponse
}

/**
 * An Http client that uses `HttpURLConnection` to send multipart requests. This class
 * can be extended to support non-multipart requests in future.
 *
 * The main feature of this client is that it streams files part of the request directly to the
 * socket, which allows to send large files without loading them entirely into the memory. It also
 * configures the `HttpUrlConnection` to `setChunkedStreamingMode` to avoid buffering the request
 * body in memory.
 */
internal class HttpUrlConnectionClient : HttpClient {
    private val connectionTimeoutMs = 30_000
    private val readTimeoutMs = 10_000
    private val boundary = "--boundary-7MA4YWxkTrZu0gW"
    private val maxRedirects = 5

    override fun sendMultipartRequest(
        url: String,
        method: String,
        headers: Map<String, String>,
        multipartData: List<MultipartData>,
    ): HttpResponse {
        return sendMultiPartRequestWithRedirects(url, method, headers, multipartData, 0)
    }

    private fun sendMultiPartRequestWithRedirects(
        url: String,
        method: String,
        headers: Map<String, String>,
        multipartData: List<MultipartData>,
        redirectCount: Int,
    ): HttpResponse {
        if (redirectCount >= maxRedirects) {
            throw IOException("Too many redirects")
        }
        var connection: HttpURLConnection? = null
        try {
            connection = createConnection(url, method, headers)
            streamMultipartData(connection.outputStream, multipartData)
            if (isRedirect(connection.responseCode)) {
                val location = connection.getHeaderField("Location")
                    ?: throw IOException("Redirect location is missing")
                val newUrl = resolveRedirectUrl(url, location)
                connection.disconnect()
                return sendMultiPartRequestWithRedirects(
                    url = newUrl,
                    method = method,
                    headers = headers,
                    multipartData = multipartData,
                    redirectCount = redirectCount + 1
                )
            }
            return processResponse(connection)
        } catch (e: IOException) {
            return HttpResponse.Error.UnknownError(e)
        } finally {
            connection?.disconnect()
        }
    }

    private fun isRedirect(responseCode: Int): Boolean {
        // Handling only 307 (Temporary Redirect) and 308 (Permanent Redirect) as the redirection
        // status codes.
        // 301, 302, and 303 change the method of the request to GET which is not suitable for
        // multipart requests.
        // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/307
        return responseCode == 307 || responseCode == 308
    }

    @Throws(IOException::class)
    private fun resolveRedirectUrl(baseUrl: String, location: String): String {
        try {
            val base = URL(baseUrl)
            val resolved = URL(base, location)
            return resolved.toString()
        } catch (e: MalformedURLException) {
            throw IOException("Invalid redirect URL", e)
        }
    }

    private fun createConnection(
        url: String,
        method: String,
        headers: Map<String, String>,
    ): HttpURLConnection {
        return (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            doOutput = true
            setChunkedStreamingMode(0)
            connectTimeout = connectionTimeoutMs
            readTimeout = readTimeoutMs
            setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
            headers.forEach { (key, value) -> setRequestProperty(key, value) }
        }
    }

    private fun streamMultipartData(
        outputStream: OutputStream,
        multipartData: List<MultipartData>,
    ) {
        val writer = OutputStreamWriter(outputStream)

        multipartData.forEach { data ->
            writeMultipartPart(writer, data)
        }

        writeClosingBoundary(writer)
    }

    private fun writeMultipartPart(writer: OutputStreamWriter, data: MultipartData) {
        val (headers, content) = when (data) {
            is MultipartData.FormField -> getFormFieldPart(data)
            is MultipartData.FileData -> getFileDataPart(data)
        }

        writeBoundary(writer)
        writeHeaders(writer, headers, content.length)
        writeContent(writer, content)
    }

    private fun writeBoundary(writer: OutputStreamWriter) {
        writer.write("--$boundary\r\n")
    }

    private fun writeHeaders(
        writer: OutputStreamWriter,
        headers: Map<String, String>,
        contentLength: Int,
    ) {
        headers.forEach { (key, value) ->
            writer.write("$key: $value\r\n")
        }
        writer.write("Content-Length: $contentLength\r\n")
        writer.write("\r\n")
    }

    private fun writeContent(writer: OutputStreamWriter, content: String) {
        writer.write(content)
        writer.write("\r\n")
        writer.flush()
    }

    private fun writeClosingBoundary(writer: OutputStreamWriter) {
        writer.write("--$boundary--\r\n")
        writer.flush()
    }

    private fun getFormFieldPart(data: MultipartData.FormField): Pair<Map<String, String>, String> {
        val headers = mapOf(
            "Content-Disposition" to "form-data; name=\"${data.name}\"",
        )
        return headers to data.value
    }

    private fun getFileDataPart(data: MultipartData.FileData): Pair<Map<String, String>, String> {
        val headers = mapOf(
            "Content-Disposition" to "form-data; name=\"${data.name}\"; filename=\"${data.filename}\"",
            "Content-Type" to data.contentType,
        )
        val content = data.inputStream.use { it.readBytes().toString(Charsets.UTF_8) }
        return headers to content
    }

    private fun processResponse(connection: HttpURLConnection): HttpResponse {
        return when (val responseCode = connection.responseCode) {
            in 200..299 -> HttpResponse.Success
            429 -> HttpResponse.Error.RateLimitError
            in 400..499 -> HttpResponse.Error.ClientError(responseCode)
            in 500..599 -> HttpResponse.Error.ServerError(responseCode)
            else -> HttpResponse.Error.UnknownError()
        }
    }
}

internal sealed class MultipartData {
    data class FormField(val name: String, val value: String) : MultipartData()
    data class FileData(
        val name: String,
        val filename: String,
        val contentType: String,
        val inputStream: InputStream,
    ) : MultipartData()
}
