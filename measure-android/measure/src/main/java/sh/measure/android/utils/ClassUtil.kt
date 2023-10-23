package sh.measure.android.utils

fun isClassAvailable(clazz: String) : Boolean {
    return loadClass(clazz) != null
}

private fun loadClass(clazz: String): Class<*>? {
    return try {
        Class.forName(clazz)
    } catch (e: ClassNotFoundException) {
        null
    } catch (e: UnsatisfiedLinkError) {
        null
    } catch (e: Throwable) {
        null
    }
}
