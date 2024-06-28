package sh.measure.android.fakes

import sh.measure.android.attributes.UserDefinedAttribute

class FakeUserDefinedAttribute: UserDefinedAttribute {
    private var attributes = mutableMapOf<String, Any?>()
    override fun put(key: String, value: Number, store: Boolean) {
        attributes[key] = value
    }

    override fun put(key: String, value: String, store: Boolean) {
        attributes[key] = value
    }

    override fun put(key: String, value: Boolean, store: Boolean) {
        attributes[key] = value
    }

    override fun getAll(): Map<String, Any?> {
        return attributes
    }

    override fun remove(key: String) {
        attributes.remove(key)
    }

    override fun clear() {
        attributes.clear()
    }
}