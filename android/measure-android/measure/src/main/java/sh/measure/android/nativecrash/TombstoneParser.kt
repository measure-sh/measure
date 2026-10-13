package sh.measure.android.nativecrash

import java.io.ByteArrayOutputStream
import java.io.InputStream

/**
 * Parses the protobuf tombstone that the OS reports for a native crash.
 * Field numbers follow AOSP system/core/debuggerd/proto/tombstone.proto.
 */
internal object TombstoneParser {
    private const val MAX_TOMBSTONE_BYTES = 4 * 1024 * 1024
    private const val GWP_ASAN_TOOL = 0

    /**
     * Returns null when the input is not a readable tombstone.
     */
    fun parse(input: InputStream): Tombstone? {
        val bytes = runCatching { readCapped(input) }.getOrNull() ?: return null
        return runCatching { parseTombstone(ProtoReader(bytes)) }.getOrNull()
    }

    private fun readCapped(input: InputStream): ByteArray? {
        val bytes = input.use { it.readAtMost(MAX_TOMBSTONE_BYTES + 1) }
        if (bytes.isEmpty() || bytes.size > MAX_TOMBSTONE_BYTES) {
            return null
        }
        return bytes
    }

    private fun InputStream.readAtMost(max: Int): ByteArray {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8192)
        while (output.size() < max) {
            val read = read(buffer, 0, minOf(buffer.size, max - output.size()))
            if (read < 0) break
            output.write(buffer, 0, read)
        }
        return output.toByteArray()
    }

    private fun parseTombstone(reader: ProtoReader): Tombstone? {
        var arch = 0
        var pid = 0
        var tid = 0
        var signal: TombstoneSignal? = null
        var abortMessage: String? = null
        val causes = mutableListOf<String>()
        var gwpAsanReport: TombstoneGwpAsanReport? = null
        var isFirstCause = true
        val threads = mutableMapOf<Int, TombstoneThread>()
        val mappings = mutableListOf<TombstoneMapping>()

        while (reader.next()) {
            when (reader.fieldNumber) {
                1 -> arch = reader.readVarint().toInt()
                5 -> pid = reader.readVarint().toInt()
                6 -> tid = reader.readVarint().toInt()
                10 -> signal = parseSignal(reader.readMessage())
                14 -> abortMessage = reader.readString().trimEnd('\u0000').takeIf { it.isNotEmpty() }
                15 -> {
                    val cause = parseCause(reader.readMessage())
                    if (isFirstCause) {
                        gwpAsanReport = cause.gwpAsanReport
                        isFirstCause = false
                    }
                    cause.humanReadable?.let { causes.add(it) }
                }
                16 -> parseThreadEntry(reader.readMessage())?.let { threads[it.id] = it }
                17 -> mappings.add(parseMapping(reader.readMessage()))
                else -> reader.skip()
            }
        }

        if (threads[tid] == null) {
            return null
        }
        return Tombstone(
            arch = archName(arch),
            pid = pid,
            tid = tid,
            signal = signal,
            abortMessage = abortMessage,
            causes = causes,
            gwpAsanReport = gwpAsanReport,
            threads = threads,
            mappings = mappings,
        )
    }

    private fun parseSignal(reader: ProtoReader): TombstoneSignal {
        var name = ""
        var codeName = ""
        var hasFaultAddress = false
        var faultAddress = 0L
        while (reader.next()) {
            when (reader.fieldNumber) {
                2 -> name = reader.readString()
                4 -> codeName = reader.readString()
                8 -> hasFaultAddress = reader.readVarint() != 0L
                9 -> faultAddress = reader.readVarint()
                else -> reader.skip()
            }
        }
        return TombstoneSignal(
            name = name,
            codeName = codeName,
            faultAddress = faultAddress.takeIf { hasFaultAddress },
        )
    }

    private class Cause(val humanReadable: String?, val gwpAsanReport: TombstoneGwpAsanReport?)

    private fun parseCause(reader: ProtoReader): Cause {
        var humanReadable: String? = null
        var gwpAsanReport: TombstoneGwpAsanReport? = null
        while (reader.next()) {
            when (reader.fieldNumber) {
                1 -> humanReadable = reader.readString()
                2 -> gwpAsanReport = parseGwpAsanReport(reader.readMessage())
                else -> reader.skip()
            }
        }
        return Cause(humanReadable?.takeIf { it.isNotEmpty() }, gwpAsanReport)
    }

    private fun parseGwpAsanReport(reader: ProtoReader): TombstoneGwpAsanReport? {
        var tool = 0
        var type = 0
        var heap: HeapObject? = null
        while (reader.next()) {
            when (reader.fieldNumber) {
                1 -> tool = reader.readVarint().toInt()
                2 -> type = reader.readVarint().toInt()
                3 -> heap = parseHeapObject(reader.readMessage())
                else -> reader.skip()
            }
        }
        if (tool != GWP_ASAN_TOOL) {
            return null
        }
        return heap?.let {
            TombstoneGwpAsanReport(
                type = type,
                allocationTid = it.allocationTid,
                allocationFrames = it.allocationFrames,
                deallocationTid = it.deallocationTid,
                deallocationFrames = it.deallocationFrames,
            )
        }
    }

    private class HeapObject(
        val allocationTid: Long,
        val allocationFrames: List<TombstoneFrame>,
        val deallocationTid: Long,
        val deallocationFrames: List<TombstoneFrame>,
    )

    private fun parseHeapObject(reader: ProtoReader): HeapObject {
        var allocationTid = 0L
        val allocationFrames = mutableListOf<TombstoneFrame>()
        var deallocationTid = 0L
        val deallocationFrames = mutableListOf<TombstoneFrame>()
        while (reader.next()) {
            when (reader.fieldNumber) {
                3 -> allocationTid = reader.readVarint()
                4 -> allocationFrames.add(parseFrame(reader.readMessage()))
                5 -> deallocationTid = reader.readVarint()
                6 -> deallocationFrames.add(parseFrame(reader.readMessage()))
                else -> reader.skip()
            }
        }
        return HeapObject(
            allocationTid = allocationTid,
            allocationFrames = allocationFrames,
            deallocationTid = deallocationTid,
            deallocationFrames = deallocationFrames,
        )
    }

    private fun parseThreadEntry(reader: ProtoReader): TombstoneThread? {
        var thread: TombstoneThread? = null
        while (reader.next()) {
            when (reader.fieldNumber) {
                2 -> thread = parseThread(reader.readMessage())
                else -> reader.skip()
            }
        }
        return thread
    }

    private fun parseThread(reader: ProtoReader): TombstoneThread {
        var id = 0
        var name = ""
        val frames = mutableListOf<TombstoneFrame>()
        while (reader.next()) {
            when (reader.fieldNumber) {
                1 -> id = reader.readVarint().toInt()
                2 -> name = reader.readString()
                4 -> frames.add(parseFrame(reader.readMessage()))
                else -> reader.skip()
            }
        }
        return TombstoneThread(id = id, name = name, frames = frames)
    }

    private fun parseFrame(reader: ProtoReader): TombstoneFrame {
        var relPc = 0L
        var pc = 0L
        var functionName: String? = null
        var fileName: String? = null
        var buildId: String? = null
        while (reader.next()) {
            when (reader.fieldNumber) {
                1 -> relPc = reader.readVarint()
                2 -> pc = reader.readVarint()
                4 -> functionName = reader.readString().takeIf { it.isNotEmpty() }
                6 -> fileName = reader.readString().takeIf { it.isNotEmpty() }
                8 -> buildId = reader.readString().takeIf { it.isNotEmpty() }
                else -> reader.skip()
            }
        }
        return TombstoneFrame(
            relPc = relPc,
            pc = pc,
            functionName = functionName,
            fileName = fileName,
            buildId = buildId,
        )
    }

    private fun parseMapping(reader: ProtoReader): TombstoneMapping {
        var begin = 0L
        var end = 0L
        var buildId: String? = null
        while (reader.next()) {
            when (reader.fieldNumber) {
                1 -> begin = reader.readVarint()
                2 -> end = reader.readVarint()
                8 -> buildId = reader.readString().takeIf { it.isNotEmpty() }
                else -> reader.skip()
            }
        }
        return TombstoneMapping(
            beginAddress = begin,
            endAddress = end,
            buildId = buildId,
        )
    }

    private fun archName(arch: Int): String = when (arch) {
        0 -> "arm"
        1 -> "arm64"
        2 -> "x86"
        3 -> "x86_64"
        4 -> "riscv64"
        else -> "unknown"
    }
}
