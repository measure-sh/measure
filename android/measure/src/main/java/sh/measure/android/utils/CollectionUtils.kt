package sh.measure.android.utils

internal fun Collection<String>.containsIgnoreCase(value: String): Boolean = this.any { it.equals(value, ignoreCase = true) }

internal fun <V> Map<String, V>.containsIgnoreCase(key: String): Boolean = this.keys.any { it.equals(key, ignoreCase = true) }
