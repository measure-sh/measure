package sh.measure.android.exporter

/**
 * Result of a batch creation operation. Contains the mapping of batch ID to all the event IDs part
 * of the batch.
 */
internal data class Batch(
    val batchId: String,
    val eventIds: List<String>,
    val spanIds: List<String>,
)
