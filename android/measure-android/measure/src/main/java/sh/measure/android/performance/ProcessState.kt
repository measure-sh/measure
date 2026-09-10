package sh.measure.android.performance

import android.app.ActivityManager.RunningAppProcessInfo

/**
 * The four process states Play Console's own Memory usage (Anon RSS + Swap)
 * vital segments memory by, so readings taken by [DynamicMemoryUsageCollector]
 * can be grouped the same way as Android vitals.
 */
internal object ProcessState {
    const val FOREGROUND = "foreground"
    const val USER_PERCEIVED_SERVICE = "user_perceived_service"
    const val BACKGROUND = "background"
    const val CACHED = "cached"

    /**
     * Maps a raw [RunningAppProcessInfo.importance] reading to one of the
     * four states above, following Play Console's own definitions:
     * IMPORTANCE_FOREGROUND is the visible app itself; everything down to
     * and including IMPORTANCE_PERCEPTIBLE covers foreground services,
     * expedited/user-initiated jobs and other perceptible work (Play's
     * "user-perceived service"); everything less important than that but
     * still above IMPORTANCE_CACHED is a background service or a
     * recently-backgrounded process not yet cached; IMPORTANCE_CACHED and
     * beyond is eligible for eviction by the system at any time.
     */
    fun from(importance: Int): String = when {
        importance <= RunningAppProcessInfo.IMPORTANCE_FOREGROUND -> FOREGROUND
        importance <= RunningAppProcessInfo.IMPORTANCE_PERCEPTIBLE -> USER_PERCEIVED_SERVICE
        importance < RunningAppProcessInfo.IMPORTANCE_CACHED -> BACKGROUND
        else -> CACHED
    }
}
