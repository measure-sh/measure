package sh.measure.android.nativecrash

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.ByteArrayInputStream

class TombstoneParserTest {
    @Test
    fun `parses a segfault tombstone`() {
        val tombstone = parseFixture("tombstones/api31_segv.pb")!!

        assertEquals("arm64", tombstone.arch)
        assertEquals(15893, tombstone.pid)
        assertEquals(15893, tombstone.tid)
        assertEquals(TombstoneSignal(name = "SIGSEGV", codeName = "SEGV_MAPERR", faultAddress = 0L), tombstone.signal)
        assertNull(tombstone.abortMessage)
        assertEquals(listOf("null pointer dereference"), tombstone.causes)
        assertEquals(47, tombstone.threads.size)
    }

    @Test
    fun `parses the memory mappings of a library loaded from the apk`() {
        val tombstone = parseFixture("tombstones/api31_segv.pb")!!
        val mappings = tombstone.mappings.filter { it.buildId == "ed5f1518a8e496bc9a66fcff801512103c2bbeb8" }

        assertEquals(listOf(0x7b5d766000, 0x7b5d76a000), mappings.map { it.beginAddress })
    }

    @Test
    fun `parses the frames of the crashing thread`() {
        val tombstone = parseFixture("tombstones/api31_segv.pb")!!
        val frames = tombstone.threads.getValue(tombstone.tid).frames

        assertEquals(119, frames.size)
        assertEquals(
            TombstoneFrame(
                relPc = 0x8d4,
                pc = 0x7b5d7668d4,
                functionName = "Java_sh_frankenstein_android_NativeCrash_segfault",
                fileName = "/data/app/~~f2qyROwD3DC6h72d9RKPKg==/sh.frankenstein.android.debug-guaf8QkWnaCtiLJYH13POQ==/base.apk!libfrank_crash.so",
                buildId = "ed5f1518a8e496bc9a66fcff801512103c2bbeb8",
            ),
            frames[1],
        )
    }

    @Test
    fun `parses a crash on a background thread`() {
        val tombstone = parseFixture("tombstones/api31_background_thread_segv.pb")!!

        assertEquals(7199, tombstone.pid)
        assertEquals(7298, tombstone.tid)
    }

    @Test
    fun `parses a gwp-asan use after free`() {
        val memoryError = parseFixture("tombstones/api31_gwp_asan_use_after_free.pb")!!.memoryError!!

        assertEquals("gwp_asan", memoryError.tool)
        assertEquals("use_after_free", memoryError.type)
        assertEquals(20644, memoryError.allocationTid)
        assertEquals(20644, memoryError.deallocationTid)
        assertEquals("malloc", memoryError.allocationFrames[3].functionName)
        assertEquals("Java_sh_frankenstein_android_NativeCrash_useAfterFree", memoryError.deallocationFrames[3].functionName)
    }

    @Test
    fun `returns null for empty input`() {
        assertNull(TombstoneParser.parse(ByteArrayInputStream(ByteArray(0))))
    }

    @Test
    fun `returns null for garbage input`() {
        assertNull(TombstoneParser.parse(ByteArrayInputStream("not a tombstone".toByteArray())))
    }

    @Test
    fun `returns null for truncated input`() {
        val bytes = fixtureBytes("tombstones/api31_segv.pb")
        assertNull(TombstoneParser.parse(ByteArrayInputStream(bytes.copyOf(bytes.size / 2))))
    }

    @Test
    fun `parses an abort without the padding after its message`() {
        val tombstone = parseFixture("tombstones/api31_abort.pb")!!

        assertEquals("Check failed: ptr != nullptr", tombstone.abortMessage)
        assertEquals(TombstoneSignal(name = "SIGABRT", codeName = "SI_QUEUE", faultAddress = null), tombstone.signal)
    }

    @Test
    fun `parses a tombstone of up to 8 MB`() {
        val bytes = withUnknownField(fixtureBytes("tombstones/api31_segv.pb"), totalSize = 8 * 1024 * 1024)

        assertNotNull(TombstoneParser.parse(ByteArrayInputStream(bytes)))
    }

    @Test
    fun `returns null for a tombstone over 8 MB`() {
        val bytes = withUnknownField(fixtureBytes("tombstones/api31_segv.pb"), totalSize = 8 * 1024 * 1024 + 1)

        assertNull(TombstoneParser.parse(ByteArrayInputStream(bytes)))
    }

    @Test
    fun `returns null for a tombstone without a signal`() {
        assertNull(TombstoneParser.parse(ByteArrayInputStream(tombstoneWithSignalName(null))))
    }

    @Test
    fun `returns null for a tombstone whose signal has no name`() {
        assertNull(TombstoneParser.parse(ByteArrayInputStream(tombstoneWithSignalName(""))))
    }

    @Test
    fun `parses a minimal tombstone with a named signal`() {
        val tombstone = TombstoneParser.parse(ByteArrayInputStream(tombstoneWithSignalName("SIGSEGV")))!!

        assertEquals("SIGSEGV", tombstone.signal.name)
    }

    @Test
    fun `parses a memory error caught by mte`() {
        val memoryError = parseMemoryError(tool = 1, type = 4)!!

        assertEquals("mte", memoryError.tool)
        assertEquals("buffer_overflow", memoryError.type)
        assertEquals(0x7b2c4a0010L, memoryError.address)
        assertEquals(32L, memoryError.size)
    }

    @Test
    fun `keeps a memory error of unknown type`() {
        assertEquals("unknown", parseMemoryError(tool = 1, type = 0)!!.type)
    }

    @Test
    fun `ignores a memory error from an unknown tool`() {
        assertNull(parseMemoryError(tool = 7, type = 1))
    }

    private fun parseMemoryError(tool: Int, type: Int): TombstoneMemoryError? {
        val heap = varintField(1, 0x7b2c4a0010L) + varintField(2, 32)
        val memoryError = varintField(1, tool.toLong()) + varintField(2, type.toLong()) + messageField(3, heap)
        val cause = messageField(2, memoryError)
        val bytes = tombstoneWithSignalName("SIGSEGV") + messageField(15, cause)
        return TombstoneParser.parse(ByteArrayInputStream(bytes))!!.memoryError
    }

    private fun varintField(number: Int, value: Long): ByteArray = varint((number shl 3).toLong()) + varint(value)

    private fun messageField(number: Int, message: ByteArray): ByteArray = varint((number shl 3 or 2).toLong()) + varint(message.size.toLong()) + message

    private fun varint(value: Long): ByteArray {
        val bytes = mutableListOf<Byte>()
        var remaining = value
        while (remaining >= 0x80) {
            bytes.add((remaining and 0x7F or 0x80).toByte())
            remaining = remaining ushr 7
        }
        bytes.add(remaining.toByte())
        return bytes.toByteArray()
    }

    /**
     * Builds a tombstone with one thread whose ID matches the default crashed thread ID of 0.
     */
    private fun tombstoneWithSignalName(name: String?): ByteArray {
        val thread = messageField(16, messageField(2, ByteArray(0)))
        if (name == null) {
            return thread
        }
        return messageField(10, messageField(2, name.toByteArray())) + thread
    }

    /**
     * Pads a tombstone to [totalSize] bytes with a field the parser skips.
     */
    private fun withUnknownField(tombstone: ByteArray, totalSize: Int): ByteArray {
        val emptyField = messageField(100, ByteArray(0))
        var payloadSize = totalSize - tombstone.size - emptyField.size
        payloadSize -= varint(payloadSize.toLong()).size - 1
        val bytes = tombstone + messageField(100, ByteArray(payloadSize))
        check(bytes.size == totalSize)
        return bytes
    }

    private fun parseFixture(path: String): Tombstone? = TombstoneParser.parse(ByteArrayInputStream(fixtureBytes(path)))

    private fun fixtureBytes(path: String): ByteArray = javaClass.classLoader!!.getResourceAsStream(path)!!.readBytes()
}
