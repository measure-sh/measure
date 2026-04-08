package sh.measure.kmp.shared

fun triggerSharedCrash() {
    throw RuntimeException("Artificial crash from shared code")
}
