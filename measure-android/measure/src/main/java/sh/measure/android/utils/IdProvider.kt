package sh.measure.android.utils

import java.util.UUID

internal interface IdProvider {
    fun createId(): String
}

internal class UUIDProvider : IdProvider {
    override fun createId(): String {
        return UUID.randomUUID().toString()
    }
}
