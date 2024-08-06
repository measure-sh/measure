package sh.measure.android.config

internal interface ConfigLoader {
    /**
     * Returns the cached config synchronously, if available. Returns `null` if cached config is
     * unavailable or failed to load.
     */
    fun getCachedConfig(): Config?

    /**
     * Fetches a fresh config from the server asynchronously and calls [onSuccess] with the result,
     * if successful. Ignores the result if the fetch fails.
     */
    fun getNetworkConfig(onSuccess: (Config) -> Unit)
}

internal class ConfigLoaderImpl : ConfigLoader {
    override fun getCachedConfig(): Config? {
        // TODO:  Load the cached config from disk.
        return null
    }

    override fun getNetworkConfig(onSuccess: (Config) -> Unit) {
        // TODO: fetch the config from the server, write it to disk and call onSuccess.
    }
}
