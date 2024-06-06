package sh.measure.android.utils

internal fun Collection<String>.containsIgnoreCase(value: String): Boolean {
    return this.any { it.equals(value, ignoreCase = true) }
}

internal fun <V> Map<String, V>.containsIgnoreCase(key: String): Boolean {
    return this.keys.any { it.equals(key, ignoreCase = true) }
}