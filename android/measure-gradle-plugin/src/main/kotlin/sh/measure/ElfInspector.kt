package sh.measure

import java.io.File
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Reads ELF section headers to tell whether a shared library still has symbols.
 */
internal object ElfInspector {
    private const val ELF_MAGIC = 0x7F454C46
    private val SYMBOL_SECTIONS = setOf(".symtab", ".debug_info")

    /**
     * Returns false for stripped libraries and for files that are not valid ELF.
     */
    fun hasSymbols(file: File): Boolean = runCatching {
        RandomAccessFile(file, "r").use { sectionNames(it).any { name -> name in SYMBOL_SECTIONS } }
    }.getOrDefault(false)

    private fun sectionNames(elf: RandomAccessFile): List<String> {
        val ident = read(elf, 0, 16)
        if (ident.int != ELF_MAGIC) {
            return emptyList()
        }
        val is64Bit = ident.get(4).toInt() == 2
        val order = if (ident.get(5).toInt() == 2) ByteOrder.BIG_ENDIAN else ByteOrder.LITTLE_ENDIAN

        val header = read(elf, 0, if (is64Bit) 64 else 52, order)
        val sectionHeaderOffset = if (is64Bit) header.getLong(0x28) else header.getInt(0x20).toUInt().toLong()
        val sectionHeaderSize = header.getShort(if (is64Bit) 0x3A else 0x2E).toUShort().toInt()
        val sectionCount = header.getShort(if (is64Bit) 0x3C else 0x30).toUShort().toInt()
        val namesIndex = header.getShort(if (is64Bit) 0x3E else 0x32).toUShort().toInt()
        if (sectionHeaderOffset == 0L || sectionCount == 0 || namesIndex >= sectionCount) {
            return emptyList()
        }

        val sections = read(elf, sectionHeaderOffset, sectionHeaderSize * sectionCount, order)
        fun nameOffset(index: Int) = sections.getInt(index * sectionHeaderSize).toUInt().toLong()
        fun fileOffset(index: Int): Long {
            val base = index * sectionHeaderSize
            return if (is64Bit) sections.getLong(base + 0x18) else sections.getInt(base + 0x10).toUInt().toLong()
        }
        fun size(index: Int): Long {
            val base = index * sectionHeaderSize
            return if (is64Bit) sections.getLong(base + 0x20) else sections.getInt(base + 0x14).toUInt().toLong()
        }

        val names = read(elf, fileOffset(namesIndex), size(namesIndex).toInt(), order).array()
        return (0 until sectionCount).map { index -> cString(names, nameOffset(index).toInt()) }
    }

    private fun cString(bytes: ByteArray, start: Int): String {
        if (start !in bytes.indices) {
            return ""
        }
        var end = start
        while (end < bytes.size && bytes[end] != 0.toByte()) end++
        return String(bytes, start, end - start, Charsets.US_ASCII)
    }

    private fun read(elf: RandomAccessFile, offset: Long, length: Int, order: ByteOrder = ByteOrder.BIG_ENDIAN): ByteBuffer {
        val bytes = ByteArray(length)
        elf.seek(offset)
        elf.readFully(bytes)
        return ByteBuffer.wrap(bytes).order(order)
    }
}
