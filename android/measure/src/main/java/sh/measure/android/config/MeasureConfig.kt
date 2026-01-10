@file:Suppress("KotlinConstantConditions")

package sh.measure.android.config

import sh.measure.android.Measure

/**
 * Configuration for the Measure SDK. See [MeasureConfig] for details.
 */
internal interface IMeasureConfig {
    val enableLogging: Boolean
    val autoStart: Boolean
    val maxDiskUsageInMb: Int
    val trackActivityIntentData: Boolean
    val requestHeadersProvider: MsrRequestHeadersProvider?
    val enableFullCollectionMode: Boolean
}

/**
 * Configuration options for the Measure SDK. Used to customize the behavior of the SDK on
 * initialization.
 */
class MeasureConfig(
    /**
     * Enable or disable internal SDK logs. Defaults to `false`.
     */
    override val enableLogging: Boolean = DefaultConfig.ENABLE_LOGGING,

    /**
     * Configures the maximum disk usage in megabytes that the Measure SDK is allowed to use.
     *
     * This is useful to control the amount of disk space used by the SDK for storing session data,
     * crash reports, and other collected information.
     *
     * Defaults to `50MB`. Allowed values are between `20MB` and `1500MB`. Any value outside this
     * range will be clamped to the nearest limit.
     *
     * All Measure SDKs store data to disk and upload it to the server in batches. While the app is
     * in foreground, the data is synced periodically and usually the disk space used by the SDK is
     * low. However, if the device is offline or the server is unreachable, the SDK will continue to
     * store data on disk until it reaches the maximum disk usage limit.
     *
     * Note that the storage usage is not exact and works on estimates and typically the SDK will
     * use much less disk space than the configured limit. When the SDK reaches the maximum disk
     * usage limit, it will start deleting the oldest data to make space for new data.
     */
    override val maxDiskUsageInMb: Int = DefaultConfig.MAX_ESTIMATED_DISK_USAGE_IN_MB,

    /**
     * Set to false to delay starting the SDK, by default initializing the SDK also starts tracking.
     *
     * Defaults to true.
     *
     * @see [Measure.start] to start the SDK.
     */
    override val autoStart: Boolean = DefaultConfig.AUTO_START,

    /**
     * Whether to capture intent data used to launch an Activity. Defaults to `false`.
     */
    override val trackActivityIntentData: Boolean = DefaultConfig.TRACK_ACTIVITY_INTENT_DATA,

    /**
     * Allows configuring custom HTTP headers for requests made by the Measure SDK to the
     * Measure API. This is useful only for self-hosted clients who may require additional
     * headers for requests in their infrastructure.
     *
     * See [MsrRequestHeadersProvider] for usage details.
     */
    override val requestHeadersProvider: MsrRequestHeadersProvider? = null,

    /**
     * Override all sampling configs and track all events and traces.
     *
     * **Note** that enabling this flag can significantly increase the cost and should typically
     * only be enabled for debug mode.
     */
    override val enableFullCollectionMode: Boolean = DefaultConfig.ENABLE_FULL_COLLECTION_MODE,
) : IMeasureConfig
