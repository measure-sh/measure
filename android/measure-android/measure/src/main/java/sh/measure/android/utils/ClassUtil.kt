package sh.measure.android.utils

internal fun isClassAvailable(clazz: String): Boolean = loadClass(clazz) != null

private fun loadClass(clazz: String): Class<*>? = try {
    Class.forName(clazz)
} catch (e: ClassNotFoundException) {
    null
} catch (e: UnsatisfiedLinkError) {
    null
} catch (e: Throwable) {
    null
}
