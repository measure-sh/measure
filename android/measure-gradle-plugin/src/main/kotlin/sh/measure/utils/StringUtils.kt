package sh.measure.utils

fun String.capitalize(): String {
    return replaceFirstChar { it.uppercase() }
}
