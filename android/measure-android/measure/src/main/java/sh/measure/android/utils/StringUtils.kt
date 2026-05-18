package sh.measure.android.utils

/**
 * Checks if the given string is in lowercase. A string is considered to be in lowercase if its
 * characters are either digits or lowercase letters.
 *
 * @return `true` if the string is in lowercase, `false` otherwise.
 */
internal fun String.isLowerCase(): Boolean = this.all { it.isDigit() || it.isLowerCase() }
