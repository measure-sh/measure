package sh.measure.android.fakes

import sh.measure.android.utils.IdProvider

internal class FakeIdProvider(
    var id: String = "fake-id",
    private val autoIncrement: Boolean = false,
) : IdProvider {
    private var counter = 0
    val generatedIds = mutableListOf<String>()

    override fun uuid(): String = if (autoIncrement) {
        val generatedId = "$id-${++counter}"
        generatedIds.add(generatedId)
        generatedId
    } else {
        id
    }

    override fun spanId(): String = if (autoIncrement) "$id-span-${++counter}" else id

    override fun traceId(): String = if (autoIncrement) "$id-trace-${++counter}" else id
}
