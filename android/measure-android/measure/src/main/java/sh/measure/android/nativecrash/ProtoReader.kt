package sh.measure.android.nativecrash

/**
 * Reads the protobuf wire format. Only supports what the tombstone needs.
 * Throws [IllegalStateException] on malformed input.
 */
internal class ProtoReader(
    private val bytes: ByteArray,
    private var position: Int = 0,
    private val limit: Int = bytes.size,
) {
    var fieldNumber: Int = 0
        private set
    private var wireType: Int = 0

    /**
     * Moves to the next field. Returns false at the end of the message.
     */
    fun next(): Boolean {
        if (position >= limit) {
            return false
        }
        val tag = readVarint()
        fieldNumber = (tag ushr 3).toInt()
        wireType = (tag and 0x7).toInt()
        check(fieldNumber > 0) { "Invalid field number" }
        return true
    }

    fun readVarint(): Long {
        var result = 0L
        var shift = 0
        while (shift < 64) {
            check(position < limit) { "Truncated varint" }
            val byte = bytes[position++].toInt()
            result = result or ((byte and 0x7F).toLong() shl shift)
            if (byte and 0x80 == 0) {
                return result
            }
            shift += 7
        }
        error("Malformed varint")
    }

    fun readString(): String {
        val length = readLength()
        val value = String(bytes, position, length, Charsets.UTF_8)
        position += length
        return value
    }

    /**
     * Returns a reader over the embedded message at the current field.
     */
    fun readMessage(): ProtoReader {
        val length = readLength()
        val reader = ProtoReader(bytes, position, position + length)
        position += length
        return reader
    }

    fun skip() {
        when (wireType) {
            WIRE_VARINT -> readVarint()
            WIRE_FIXED64 -> advance(8)
            WIRE_LENGTH_DELIMITED -> advance(readLength())
            WIRE_FIXED32 -> advance(4)
            else -> error("Unsupported wire type $wireType")
        }
    }

    private fun readLength(): Int {
        check(wireType == WIRE_LENGTH_DELIMITED) { "Expected length-delimited field" }
        val length = readVarint()
        check(length >= 0 && length <= limit - position) { "Truncated field" }
        return length.toInt()
    }

    private fun advance(count: Int) {
        check(count <= limit - position) { "Truncated field" }
        position += count
    }

    private companion object {
        const val WIRE_VARINT = 0
        const val WIRE_FIXED64 = 1
        const val WIRE_LENGTH_DELIMITED = 2
        const val WIRE_FIXED32 = 5
    }
}
