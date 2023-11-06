package sh.measure.android.utils

internal class CurrentThread {
    val name: String
        get() = Thread.currentThread().name
}