package sh.measure.android.fakes

import sh.measure.android.anr.AnrExit
import sh.measure.android.anr.AnrExitData

internal class FakeAnrExit : AnrExit {
    var anrExits = listOf(
        AnrExitData(
            pid = 7654,
            timestampMs = 987654321L,
            threadDump = null,
            subject = null,
            foreground = true,
        ),
    )
    val tracedPids = mutableListOf<Int>()

    override fun get(): List<AnrExitData> = anrExits

    override fun withTrace(exit: AnrExitData): AnrExitData {
        tracedPids.add(exit.pid)
        return exit
    }
}
