package sh.measure.android.anr

import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.serialization.jsonSerializer
import sh.measure.android.storage.Database
import sh.measure.android.storage.DraftAnr
import sh.measure.android.storage.FileStorage
import sh.measure.android.tracing.InternalTrace

/**
 * The ANRs stored as drafts until the next launch, where the system's record of the
 * process that died can be merged into them.
 */
internal interface DraftAnrStore {
    /**
     * Returns every draft ANR, along with the pid of the process that recorded it.
     */
    fun getAll(): List<DraftAnr>

    /**
     * Rewrites the draft's body with the system's view of the ANR. A failure leaves
     * the body as the SDK captured it, which the flush still reports.
     */
    fun mergeThreadDump(draftAnr: DraftAnr, threadDump: String, subject: String?)

    /**
     * Finalizes the draft ANRs of every process other than [currentPid], which lets
     * them export. A process only gets an exit record once it has died, so a draft
     * left by a dead pid can never be merged any further.
     */
    fun finalize(currentPid: Int)
}

internal class DraftAnrStoreImpl(
    private val logger: Logger,
    private val database: Database,
    private val fileStorage: FileStorage,
) : DraftAnrStore {

    override fun getAll(): List<DraftAnr> = database.getDraftAnrs()

    override fun mergeThreadDump(draftAnr: DraftAnr, threadDump: String, subject: String?) {
        val file = draftAnr.filePath?.let(fileStorage::getFile)
        if (file == null) {
            logger.log(LogLevel.Debug, "Missing body for ANR(${draftAnr.eventId})")
            return
        }
        InternalTrace.trace(
            { "msr-merge-thread-dump" },
            {
                runCatching {
                    val data = jsonSerializer.decodeFromString(
                        ExceptionData.serializer(),
                        file.readText(),
                    )
                    val merged = data.copy(art_thread_dump = threadDump, subject = subject)
                    file.writeText(
                        jsonSerializer.encodeToString(ExceptionData.serializer(), merged),
                    )
                }.onFailure {
                    logger.log(
                        LogLevel.Debug,
                        "Failed to merge the thread dump into ANR(${draftAnr.eventId})",
                        it,
                    )
                }
            },
        )
    }

    override fun finalize(currentPid: Int) = database.finalizeDrafts(currentPid)
}
