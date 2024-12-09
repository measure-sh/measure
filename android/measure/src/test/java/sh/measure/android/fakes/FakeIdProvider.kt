package sh.measure.android.fakes

import sh.measure.android.utils.IdProvider

internal class FakeIdProvider(var id: String = "fake-id") : IdProvider {
    override fun uuid(): String {
        return id
    }

    override fun spanId(): String {
        return id
    }

    override fun traceId(): String {
        return id
    }
}
