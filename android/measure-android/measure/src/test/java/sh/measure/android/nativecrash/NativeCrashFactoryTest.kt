package sh.measure.android.nativecrash

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import sh.measure.android.exceptions.BinaryImage
import sh.measure.android.exceptions.ExceptionSeverity
import sh.measure.android.exceptions.Frame

private const val PACKAGE_NAME = "sh.frankenstein.android.debug"

class NativeCrashFactoryTest {
    private val data = NativeCrashFactory.create(parse("tombstones/api31_segv.pb"), foreground = true, packageName = PACKAGE_NAME)

    private fun parse(path: String): Tombstone = TombstoneParser.parse(javaClass.classLoader!!.getResourceAsStream(path)!!)!!

    @Test
    fun `reports the crashing thread as the exception`() {
        val exception = data.exceptions.single()

        assertEquals("ndk", data.framework)
        assertEquals(ExceptionSeverity.Fatal, data.severity)
        assertTrue(data.foreground)
        assertEquals("SIGSEGV", exception.type)
        assertEquals("SEGV_MAPERR at 0x0", exception.message)
        assertEquals("main", exception.thread_name)
        assertEquals(119, exception.frames.size)
    }

    @Test
    fun `sets the native crash details`() {
        assertNull(data.abort_message)
        assertEquals("null pointer dereference", data.cause)
    }

    @Test
    fun `reports other threads separately`() {
        assertEquals(46, data.threads.size)
        assertFalse(data.threads.any { it.name == "main" })
    }

    @Test
    fun `maps an app library frame`() {
        assertEquals(
            Frame(
                method_name = "Java_sh_frankenstein_android_NativeCrash_segfault",
                instruction_address = "0x7b5d7668d4",
                binary_address = "0x7b5d766000",
                binary_name = "libfrank_crash.so",
                frame_index = 1,
                in_app = true,
            ),
            data.exceptions.single().frames[1],
        )
    }

    @Test
    fun `marks libraries of other installed packages as not in app`() {
        val tombstone = parse("tombstones/api31_segv.pb")
        val webView = tombstone.copy(
            threads = tombstone.threads.mapValues { (_, thread) ->
                thread.copy(
                    frames = thread.frames.map {
                        it.copy(fileName = it.fileName?.replace("/$PACKAGE_NAME-", "/com.google.android.webview-"))
                    },
                )
            },
        )

        val frame = NativeCrashFactory.create(webView, foreground = true, packageName = PACKAGE_NAME).exceptions.single().frames[1]

        assertEquals("libfrank_crash.so", frame.binary_name)
        assertFalse(frame.in_app)
    }

    @Test
    fun `marks system library frames as not in app`() {
        val frame = data.exceptions.single().frames[2]

        assertEquals("libart.so", frame.binary_name)
        assertFalse(frame.in_app)
    }

    @Test
    fun `marks java frames as not in app`() {
        val frame = data.exceptions.single().frames[4]

        assertEquals("classes4.dex", frame.binary_name)
        assertEquals("sh.frankenstein.android.NativeAndroidScreenKt.NativeAndroidScreen\$lambda\$25\$0", frame.method_name)
        assertFalse(frame.in_app)
    }

    @Test
    fun `reports an abort with its message`() {
        val abort = NativeCrashFactory.create(parse("tombstones/api31_abort.pb"), foreground = true, packageName = PACKAGE_NAME)
        val exception = abort.exceptions.single()

        assertEquals("SIGABRT", exception.type)
        assertEquals("SI_QUEUE", exception.message)
        assertEquals("Check failed: ptr != nullptr", abort.abort_message)
        assertNull(abort.cause)
    }

    @Test
    fun `adds one binary image per referenced build id`() {
        val images = data.binary_images

        assertEquals(images.size, images.distinctBy { it.uuid }.size)
        assertEquals(
            BinaryImage(
                uuid = "ed5f1518a8e496bc9a66fcff801512103c2bbeb8",
                arch = "arm64",
                base_addr = "0x7b5d766000",
                name = "libfrank_crash.so",
                path = "/data/app/~~f2qyROwD3DC6h72d9RKPKg==/sh.frankenstein.android.debug-guaf8QkWnaCtiLJYH13POQ==/base.apk!libfrank_crash.so",
                start_addr = "0x7b5d766000",
                end_addr = "0x7b5d76b000",
                system = false,
            ),
            images.first { it.name == "libfrank_crash.so" },
        )
        assertTrue(images.first { it.name == "libart.so" }.system)
    }

    @Test
    fun `reports a thread by the name the os gives it`() {
        val background = NativeCrashFactory.create(parse("tombstones/api31_background_thread_segv.pb"), foreground = true, packageName = PACKAGE_NAME)

        assertEquals("n.android.debug", background.exceptions.single().thread_name)
    }

    @Test
    fun `reports a gwp-asan use after free with where the memory was allocated and freed`() {
        val data = NativeCrashFactory.create(parse("tombstones/api31_gwp_asan_use_after_free.pb"), foreground = true, packageName = PACKAGE_NAME)
        val gwpAsanReport = data.gwp_asan_report!!

        assertEquals("use_after_free", gwpAsanReport.type)
        assertEquals("Use After Free, 0 bytes into a 32-byte allocation at 0x7718e1afe0", data.cause)
        assertEquals(20644, gwpAsanReport.allocation!!.thread_id)
        assertEquals(20644, gwpAsanReport.deallocation!!.thread_id)
        assertEquals("main", gwpAsanReport.allocation!!.thread_name)
        assertEquals("main", gwpAsanReport.deallocation!!.thread_name)
    }

    @Test
    fun `names app library frames in gwp-asan report stacks by the library`() {
        val deallocation = NativeCrashFactory.create(parse("tombstones/api31_gwp_asan_use_after_free.pb"), foreground = true, packageName = PACKAGE_NAME)
            .gwp_asan_report!!.deallocation!!.frames

        assertEquals(
            Frame(
                method_name = "Java_sh_frankenstein_android_NativeCrash_useAfterFree",
                instruction_address = "0x768ddf3b10",
                binary_address = "0x768ddf3000",
                binary_name = "libfrank_crash.so",
                frame_index = 3,
                in_app = true,
            ),
            deallocation[3],
        )
        assertTrue(deallocation.none { it.instruction_address == "0x0" })
    }
}
