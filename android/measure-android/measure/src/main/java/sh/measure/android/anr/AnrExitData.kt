package sh.measure.android.anr

import android.app.ApplicationExitInfo

/**
 * The system's record of an ANR that killed a process, read from
 * [ApplicationExitInfo] on the launch after it.
 */
internal data class AnrExitData(
    /**
     * @see [ApplicationExitInfo.getPid]
     */
    val pid: Int,

    /**
     * @see [ApplicationExitInfo.getTimestamp]
     */
    val timestampMs: Long,

    /**
     * The thread dump for every thread in the process, read from
     * [ApplicationExitInfo.getTraceInputStream].
     */
    val threadDump: String?,

    /**
     * The system's one line cause for the ANR, read from the `Subject:` line of
     * [ApplicationExitInfo.getTraceInputStream].
     */
    val subject: String?,

    /**
     * Whether the process was in the foreground when the system killed it.
     */
    val foreground: Boolean,
)
