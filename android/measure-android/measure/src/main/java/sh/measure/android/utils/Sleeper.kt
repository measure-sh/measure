package sh.measure.android.utils

internal interface Sleeper {
    fun sleep(ms: Long)
}

internal class DefaultSleeper : Sleeper {
    override fun sleep(ms: Long) {
        Thread.sleep(ms)
    }
}
