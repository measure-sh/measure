package sh.measure.android.utils

internal interface RuntimeProvider {
    fun maxMemory(): Long
    fun totalMemory(): Long
    fun freeMemory(): Long
}

internal class DefaultRuntimeProvider : RuntimeProvider {
    override fun maxMemory(): Long {
        return Runtime.getRuntime().maxMemory()
    }

    override fun totalMemory(): Long {
        return Runtime.getRuntime().totalMemory()
    }

    override fun freeMemory(): Long {
        return Runtime.getRuntime().freeMemory()
    }
}
