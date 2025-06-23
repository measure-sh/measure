package sh.measure.android.config

interface MsrRequestHeadersProvider {
    fun getRequestHeaders(): Map<String, String>
}