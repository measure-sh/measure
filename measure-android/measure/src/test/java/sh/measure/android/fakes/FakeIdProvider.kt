package sh.measure.android.fakes

import sh.measure.android.utils.IdProvider

internal class FakeIdProvider(val id: String = "fake-id"): IdProvider {
    override fun createId(): String {
        return id
    }
}