package sh.measure.android.httpurl

import android.os.Build
import androidx.annotation.RequiresApi
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.net.URL
import java.security.Permission
import java.security.Principal
import java.security.cert.Certificate
import javax.net.ssl.HostnameVerifier
import javax.net.ssl.HttpsURLConnection
import javax.net.ssl.SSLPeerUnverifiedException
import javax.net.ssl.SSLSocketFactory

/**
 * HTTPS counterpart of [MsrHttpURLConnection]. Required because user code
 * frequently casts the result of [java.net.URL.openConnection] to
 * [HttpsURLConnection] and calls TLS-specific getters; our wrapper must extend
 * [HttpsURLConnection] for those casts to succeed.
 */
internal class MsrHttpsURLConnection(
    private val delegate: HttpsURLConnection,
    private val recorder: HttpUrlConnectionRecorder,
) : HttpsURLConnection(delegate.url) {
    @Volatile private var wrappedRequestStream: RequestOutputStream? = null

    @Volatile private var wrappedResponseStream: ResponseInputStream? = null

    @Volatile private var wrappedErrorStream: ResponseInputStream? = null

    private fun startRecording() {
        recorder.onRequestStart(delegate.requestMethod ?: "")
    }

    override fun getCipherSuite(): String = delegate.cipherSuite

    @Throws(SSLPeerUnverifiedException::class)
    override fun getPeerPrincipal(): Principal = delegate.peerPrincipal

    override fun getLocalPrincipal(): Principal? = delegate.localPrincipal

    @Throws(SSLPeerUnverifiedException::class)
    override fun getServerCertificates(): Array<Certificate> = delegate.serverCertificates

    override fun getLocalCertificates(): Array<Certificate>? = delegate.localCertificates

    override fun getHostnameVerifier(): HostnameVerifier = delegate.hostnameVerifier

    override fun setHostnameVerifier(v: HostnameVerifier) {
        delegate.hostnameVerifier = v
    }

    override fun getSSLSocketFactory(): SSLSocketFactory = delegate.sslSocketFactory

    override fun setSSLSocketFactory(sf: SSLSocketFactory) {
        delegate.sslSocketFactory = sf
    }

    override fun disconnect() {
        try {
            delegate.disconnect()
        } finally {
            recorder.finalizeAndTrack()
        }
    }

    override fun usingProxy(): Boolean = delegate.usingProxy()

    override fun connect() {
        startRecording()
        try {
            delegate.connect()
        } catch (e: IOException) {
            recorder.onFailure(e)
            recorder.finalizeAndTrack()
            throw e
        }
    }

    override fun getResponseCode(): Int {
        startRecording()
        return try {
            val code = delegate.responseCode
            recorder.onResponseHeadersReceived(delegate)
            code
        } catch (e: IOException) {
            recorder.onResponseHeadersReceived(delegate)
            recorder.onFailure(e)
            recorder.finalizeAndTrack()
            throw e
        }
    }

    override fun getResponseMessage(): String? = delegate.responseMessage

    override fun setRequestMethod(method: String) {
        delegate.requestMethod = method
    }

    override fun getRequestMethod(): String = delegate.requestMethod

    override fun getInstanceFollowRedirects(): Boolean = delegate.instanceFollowRedirects

    override fun setInstanceFollowRedirects(followRedirects: Boolean) {
        delegate.instanceFollowRedirects = followRedirects
    }

    override fun getErrorStream(): InputStream? {
        val raw = delegate.errorStream ?: return null
        recorder.onResponseHeadersReceived(delegate)
        val cached = wrappedErrorStream
        if (cached != null) return cached
        val wrapped = ResponseInputStream(raw, recorder)
        wrappedErrorStream = wrapped
        return wrapped
    }

    override fun setChunkedStreamingMode(chunklen: Int) {
        delegate.setChunkedStreamingMode(chunklen)
    }

    override fun setFixedLengthStreamingMode(contentLength: Int) {
        delegate.setFixedLengthStreamingMode(contentLength)
    }

    override fun setFixedLengthStreamingMode(contentLength: Long) {
        delegate.setFixedLengthStreamingMode(contentLength)
    }

    override fun getHeaderFieldDate(name: String, default: Long): Long = delegate.getHeaderFieldDate(name, default)

    override fun getInputStream(): InputStream {
        startRecording()
        val cached = wrappedResponseStream
        if (cached != null) return cached
        return try {
            val raw = delegate.inputStream
            recorder.onResponseHeadersReceived(delegate)
            val wrapped = ResponseInputStream(raw, recorder)
            wrappedResponseStream = wrapped
            wrapped
        } catch (e: IOException) {
            recorder.onResponseHeadersReceived(delegate)
            recorder.onFailure(e)
            throw e
        }
    }

    override fun getOutputStream(): OutputStream {
        startRecording()
        val cached = wrappedRequestStream
        if (cached != null) return cached
        return try {
            val raw = delegate.outputStream
            val wrapped = RequestOutputStream(raw, recorder)
            wrappedRequestStream = wrapped
            wrapped
        } catch (e: IOException) {
            recorder.onFailure(e)
            recorder.finalizeAndTrack()
            throw e
        }
    }

    override fun getURL(): URL = delegate.url

    override fun getContentLength(): Int = delegate.contentLength

    @RequiresApi(Build.VERSION_CODES.N)
    override fun getContentLengthLong(): Long = delegate.contentLengthLong

    override fun getContentType(): String? = delegate.contentType

    override fun getContentEncoding(): String? = delegate.contentEncoding

    override fun getExpiration(): Long = delegate.expiration

    override fun getDate(): Long = delegate.date

    override fun getLastModified(): Long = delegate.lastModified

    override fun getHeaderField(name: String?): String? = delegate.getHeaderField(name)

    override fun getHeaderFields(): Map<String, List<String>> = delegate.headerFields

    override fun getHeaderFieldInt(name: String, default: Int): Int = delegate.getHeaderFieldInt(name, default)

    @RequiresApi(Build.VERSION_CODES.N)
    override fun getHeaderFieldLong(name: String, default: Long): Long = delegate.getHeaderFieldLong(name, default)

    override fun getHeaderFieldKey(n: Int): String? = delegate.getHeaderFieldKey(n)

    override fun getHeaderField(n: Int): String? = delegate.getHeaderField(n)

    @Throws(IOException::class)
    override fun getContent(): Any? {
        startRecording()
        return delegate.content
    }

    @Throws(IOException::class)
    override fun getContent(classes: Array<out Class<*>>?): Any? {
        startRecording()
        return delegate.getContent(classes)
    }

    @Throws(IOException::class)
    override fun getPermission(): Permission? = delegate.permission

    override fun setDoInput(doinput: Boolean) {
        delegate.doInput = doinput
    }

    override fun getDoInput(): Boolean = delegate.doInput

    override fun setDoOutput(dooutput: Boolean) {
        delegate.doOutput = dooutput
    }

    override fun getDoOutput(): Boolean = delegate.doOutput

    override fun setAllowUserInteraction(allowuserinteraction: Boolean) {
        delegate.allowUserInteraction = allowuserinteraction
    }

    override fun getAllowUserInteraction(): Boolean = delegate.allowUserInteraction

    override fun setUseCaches(usecaches: Boolean) {
        delegate.useCaches = usecaches
    }

    override fun getUseCaches(): Boolean = delegate.useCaches

    override fun setIfModifiedSince(ifmodifiedsince: Long) {
        delegate.ifModifiedSince = ifmodifiedsince
    }

    override fun getIfModifiedSince(): Long = delegate.ifModifiedSince

    override fun getDefaultUseCaches(): Boolean = delegate.defaultUseCaches

    override fun setDefaultUseCaches(defaultusecaches: Boolean) {
        delegate.defaultUseCaches = defaultusecaches
    }

    override fun setRequestProperty(key: String, value: String?) {
        delegate.setRequestProperty(key, value)
    }

    override fun addRequestProperty(key: String, value: String?) {
        delegate.addRequestProperty(key, value)
    }

    override fun getRequestProperty(key: String): String? = delegate.getRequestProperty(key)

    override fun getRequestProperties(): Map<String, List<String>> = delegate.requestProperties

    override fun setConnectTimeout(timeout: Int) {
        delegate.connectTimeout = timeout
    }

    override fun getConnectTimeout(): Int = delegate.connectTimeout

    override fun setReadTimeout(timeout: Int) {
        delegate.readTimeout = timeout
    }

    override fun getReadTimeout(): Int = delegate.readTimeout

    override fun toString(): String = delegate.toString()
}
