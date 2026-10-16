package sh.measure.android.nativecrash

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class ProtoReaderTest {
    @Test
    fun `reads an address with the top bit set`() {
        val reader = ProtoReader(bytes(0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x01))

        assertEquals("ffffffffffffffff", java.lang.Long.toHexString(reader.readVarint()))
    }

    @Test
    fun `rejects a varint longer than ten bytes`() {
        val reader = ProtoReader(ByteArray(11) { 0x80.toByte() })

        assertThrows(IllegalStateException::class.java) { reader.readVarint() }
    }

    @Test
    fun `rejects a length longer than the message`() {
        // field 1, length-delimited, length 0x7fffffff
        val reader = ProtoReader(bytes(0x0a, 0xff, 0xff, 0xff, 0xff, 0x07))
        reader.next()

        assertThrows(IllegalStateException::class.java) { reader.readString() }
    }

    @Test
    fun `rejects a group wire type`() {
        // field 1, start group
        val reader = ProtoReader(bytes(0x0b))
        reader.next()

        assertThrows(IllegalStateException::class.java) { reader.skip() }
    }

    @Test
    fun `an embedded message stops at its own length`() {
        // field 1 = message { field 2 = "a" }, then field 3 = 7
        val reader = ProtoReader(bytes(0x0a, 0x03, 0x12, 0x01, 0x61, 0x18, 0x07))
        reader.next()
        val message = reader.readMessage()

        assertTrue(message.next())
        assertEquals(2, message.fieldNumber)
        assertEquals("a", message.readString())
        assertFalse(message.next())

        assertTrue(reader.next())
        assertEquals(3, reader.fieldNumber)
        assertEquals(7L, reader.readVarint())
    }

    private fun bytes(vararg values: Int) = ByteArray(values.size) { values[it].toByte() }
}
