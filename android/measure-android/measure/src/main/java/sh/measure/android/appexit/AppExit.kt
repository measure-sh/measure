package sh.measure.android.appexit

import sh.measure.android.nativecrash.Tombstone

/**
 * An earlier process exit that can be reported, read from
 * [android.app.ApplicationExitInfo].
 */
internal sealed interface AppExit {
    /**
     * The ID of the process that exited.
     */
    val pid: Int

    /**
     * The time the process exited, in milliseconds since epoch.
     */
    val timestamp: Long

    /**
     * Whether the process was visible to the user when it exited.
     */
    val foreground: Boolean

    data class Anr(
        override val pid: Int,
        override val timestamp: Long,
        override val foreground: Boolean,
        /**
         * The thread section of the ART trace.
         */
        val trace: String,
        /**
         * The `Subject:` line from the ART trace, or the exit description
         * when the trace has none.
         */
        val subject: String?,
    ) : AppExit

    data class NativeCrash(
        override val pid: Int,
        override val timestamp: Long,
        override val foreground: Boolean,
        val tombstone: Tombstone,
        /**
         * Whether the process kept running after the error, as it does in
         * recoverable GWP-ASan and permissive MTE modes.
         */
        val recoverable: Boolean,
    ) : AppExit
}
