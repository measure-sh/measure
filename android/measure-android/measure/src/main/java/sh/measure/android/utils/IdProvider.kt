package sh.measure.android.utils

import java.util.UUID

internal interface IdProvider {
    /**
     * Returns a type 4 (pseudo randomly generated) UUID.
     */
    fun uuid(): String

    /**
     * Generates a new valid span ID. It is 8 bytes (64-bit) represented
     * as 16 lowercase hex characters.
     *
     * @return a new valid span ID.
     */
    fun spanId(): String

    /**
     * Generates a new valid trace ID. It is 16 bytes (128-bit) represented
     * as 32 lowercase hex characters
     *
     * @return a new valid trace ID.
     */
    fun traceId(): String
}

internal class IdProviderImpl(private val randomizer: Randomizer) : IdProvider {
    override fun uuid(): String = UUID.randomUUID().toString()

    override fun spanId(): String {
        val result = CharArray(16)
        var id: Long
        do {
            id = randomizer.nextLong()
        } while (id == 0L)
        OtelEncodingUtils.longToBase16String(id, result, 0)
        return String(result, 0, 16)
    }

    override fun traceId(): String {
        val idHi: Long = randomizer.nextLong()
        var idLo: Long
        do {
            idLo = randomizer.nextLong()
        } while (idLo == 0L)
        val chars = CharArray(32)
        OtelEncodingUtils.longToBase16String(idHi, chars, 0)
        OtelEncodingUtils.longToBase16String(idLo, chars, 16)
        return String(chars, 0, 32)
    }
}
