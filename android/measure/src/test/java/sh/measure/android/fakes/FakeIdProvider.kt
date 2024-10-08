package sh.measure.android.fakes

import sh.measure.android.utils.IdProvider
import java.util.UUID

internal class FakeIdProvider(var id: String = "fake-id") : IdProvider {
    override fun createId(): String {
        return id
    }
}

internal class RandomIdProvider : IdProvider {
    override fun createId(): String {
        return UUID.randomUUID().toString()
    }
}
