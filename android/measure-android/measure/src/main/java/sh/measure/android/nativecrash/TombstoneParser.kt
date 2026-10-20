package sh.measure.android.nativecrash

import okio.buffer
import okio.source
import java.io.InputStream

/**
 * Parses the protobuf tombstone that the OS reports for a native crash.
 * Field numbers follow AOSP system/core/debuggerd/proto/tombstone.proto.
 */
internal object TombstoneParser {
    private const val MAX_TOMBSTONE_BYTES = 8 * 1024 * 1024
    private const val UNKNOWN_MEMORY_ERROR_TYPE = "unknown"

    // The OS reports MTE errors under the Scudo allocator, which uses MTE to find them.
    private val MEMORY_ERROR_TOOLS = mapOf(
        0 to "gwp_asan",
        1 to "mte",
    )
    private val MEMORY_ERROR_TYPES = mapOf(
        1 to "use_after_free",
        2 to "double_free",
        3 to "invalid_free",
        4 to "buffer_overflow",
        5 to "buffer_underflow",
    )

    /**
     * Returns null when the input is not a readable tombstone, or when it is
     * larger than [MAX_TOMBSTONE_BYTES] or has no signal.
     */
    fun parse(input: InputStream): Tombstone? = runCatching {
        input.source().buffer().use { source ->
            if (source.request(MAX_TOMBSTONE_BYTES + 1L)) {
                return null
            }
            val bytes = source.buffer.readByteArray()
            if (bytes.isEmpty()) {
                return null
            }
            parseTombstone(ProtoReader(bytes))
        }
    }.getOrNull()

    private fun parseTombstone(reader: ProtoReader): Tombstone? {
        var arch = 0
        var pid = 0
        var tid = 0
        var signal: TombstoneSignal? = null
        var abortMessage: String? = null
        val causes = mutableListOf<String>()
        var memoryError: TombstoneMemoryError? = null
        var causeCount = 0
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
                    // The OS lists the most likely cause first.
                    if (causeCount == 0) {
                        memoryError = cause.memoryError
                    }
                    causeCount++
                    cause.humanReadable?.let { causes.add(it) }
                }
                16 -> parseThreadEntry(reader.readMessage())?.let { threads[it.id] = it }
                17 -> mappings.add(parseMapping(reader.readMessage()))
                else -> reader.skip()
            }
        }

        if (signal == null || threads[tid] == null) {
            return null
        }
        return Tombstone(
            arch = archName(arch),
            pid = pid,
            tid = tid,
            signal = signal,
            abortMessage = abortMessage,
            causes = causes,
            memoryError = memoryError,
            threads = threads,
            mappings = mappings,
        )
    }

    private fun parseSignal(reader: ProtoReader): TombstoneSignal? {
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
        if (name.isEmpty()) {
            return null
        }
        return TombstoneSignal(
            name = name,
            codeName = codeName,
            faultAddress = faultAddress.takeIf { hasFaultAddress },
        )
    }

    private class Cause(val humanReadable: String?, val memoryError: TombstoneMemoryError?)

    private fun parseCause(reader: ProtoReader): Cause {
        var humanReadable: String? = null
        var memoryError: TombstoneMemoryError? = null
        while (reader.next()) {
            when (reader.fieldNumber) {
                1 -> humanReadable = reader.readString()
                2 -> memoryError = parseMemoryError(reader.readMessage())
                else -> reader.skip()
            }
        }
        return Cause(humanReadable?.takeIf { it.isNotEmpty() }, memoryError)
    }

    private fun parseMemoryError(reader: ProtoReader): TombstoneMemoryError? {
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
        val toolName = MEMORY_ERROR_TOOLS[tool] ?: return null
        return TombstoneMemoryError(
            tool = toolName,
            type = MEMORY_ERROR_TYPES[type] ?: UNKNOWN_MEMORY_ERROR_TYPE,
            address = heap?.address,
            size = heap?.size,
            allocationTid = heap?.allocationTid,
            allocationFrames = heap?.allocationFrames.orEmpty(),
            deallocationTid = heap?.deallocationTid,
            deallocationFrames = heap?.deallocationFrames.orEmpty(),
        )
    }

    private class HeapObject(
        val address: Long,
        val size: Long,
        val allocationTid: Int,
        val allocationFrames: List<TombstoneFrame>,
        val deallocationTid: Int,
        val deallocationFrames: List<TombstoneFrame>,
    )

    private fun parseHeapObject(reader: ProtoReader): HeapObject {
        var address = 0L
        var size = 0L
        var allocationTid = 0
        val allocationFrames = mutableListOf<TombstoneFrame>()
        var deallocationTid = 0
        val deallocationFrames = mutableListOf<TombstoneFrame>()
        while (reader.next()) {
            when (reader.fieldNumber) {
                1 -> address = reader.readVarint()
                2 -> size = reader.readVarint()
                3 -> allocationTid = reader.readVarint().toInt()
                4 -> allocationFrames.add(parseFrame(reader.readMessage()))
                5 -> deallocationTid = reader.readVarint().toInt()
                6 -> deallocationFrames.add(parseFrame(reader.readMessage()))
                else -> reader.skip()
            }
        }
        return HeapObject(
            address = address,
            size = size,
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
