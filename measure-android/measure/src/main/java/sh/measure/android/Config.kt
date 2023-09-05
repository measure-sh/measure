package sh.measure.android

/**
 * An abstraction over [BuildConfig] to keep all app configs in one place.
 */
object Config {
    /**
     * The base url of the Measure server.
     */
    const val MEASURE_BASE_URL: String = BuildConfig.MEASURE_BASE_URL

    /**
     * The secret token used to authenticate with the Measure server.
     */
    const val MEASURE_SECRET_TOKEN: String = BuildConfig.MEASURE_SECRET_TOKEN

    /**
     * The version of the Measure SDK.
     */
    const val MEASURE_SDK_VERSION: String = BuildConfig.MEASURE_SDK_VERSION
}