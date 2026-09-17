package sh.frankenstein.android

import androidx.annotation.Keep

/** Native allocations are independent of the Java heap and held until release. */
@Keep
internal object NativeMemory {
    init {
        System.loadLibrary("frank_memory")
    }

    /** Returns the retained total in MB (1024 * 1024 bytes), or -1 on malloc failure. */
    @Synchronized
    external fun allocate100Mb(): Long

    @Synchronized
    external fun release()

    @Synchronized
    external fun heldMb(): Long
}
