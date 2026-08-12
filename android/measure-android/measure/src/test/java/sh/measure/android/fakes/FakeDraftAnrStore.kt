package sh.measure.android.fakes

import sh.measure.android.anr.DraftAnrStore
import sh.measure.android.storage.DraftAnr

internal data class ThreadDumpMerge(
    val draftAnr: DraftAnr,
    val threadDump: String,
    val subject: String?,
)

internal class FakeDraftAnrStore : DraftAnrStore {
    var draftAnrs: List<DraftAnr> = emptyList()
    val merges = mutableListOf<ThreadDumpMerge>()
    var clearedForPid: Int? = null

    override fun getAll(): List<DraftAnr> = draftAnrs

    override fun mergeThreadDump(draftAnr: DraftAnr, threadDump: String, subject: String?) {
        merges.add(ThreadDumpMerge(draftAnr, threadDump, subject))
    }

    override fun finalize(currentPid: Int) {
        clearedForPid = currentPid
    }
}
