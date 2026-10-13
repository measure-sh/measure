package sh.measure.android.nativecrash

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
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
        val gwpAsanReport = parseFixture("tombstones/api31_gwp_asan_use_after_free.pb")!!.gwpAsanReport!!

        assertEquals(1, gwpAsanReport.type)
        assertEquals(20644, gwpAsanReport.allocationTid)
        assertEquals(20644, gwpAsanReport.deallocationTid)
        assertEquals("malloc", gwpAsanReport.allocationFrames[3].functionName)
        assertEquals("Java_sh_frankenstein_android_NativeCrash_useAfterFree", gwpAsanReport.deallocationFrames[3].functionName)
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

    private fun parseFixture(path: String): Tombstone? = TombstoneParser.parse(ByteArrayInputStream(fixtureBytes(path)))

    private fun fixtureBytes(path: String): ByteArray = javaClass.classLoader!!.getResourceAsStream(path)!!.readBytes()
}
