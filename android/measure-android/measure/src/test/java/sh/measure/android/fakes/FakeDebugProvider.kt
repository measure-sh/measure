package sh.measure.android.fakes

import android.os.Debug.MemoryInfo
import sh.measure.android.utils.DebugProvider

internal class FakeDebugProvider : DebugProvider {
    override fun getNativeHeapSize(): Long = 100L

    override fun getNativeHeapFreeSize(): Long = 100L

    override fun populateMemoryInfo(memoryInfo: MemoryInfo) {
        memoryInfo.dalvikPss = 100
        memoryInfo.nativePss = 100
        memoryInfo.otherPss = 100
        memoryInfo.dalvikPrivateDirty = 100
        memoryInfo.nativePrivateDirty = 100
        memoryInfo.otherPrivateDirty = 100
        memoryInfo.dalvikSharedDirty = 100
        memoryInfo.nativeSharedDirty = 100
        memoryInfo.otherSharedDirty = 100
    }
}
