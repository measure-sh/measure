package sh.frankenstein.android

// R8 inlines placeOrder and validate into submit in release builds.
internal object InlinedCrash {
    fun submit() {
        placeOrder(listOf(0))
    }

    private fun placeOrder(items: List<Int>) {
        validate(items.sum())
    }

    private fun validate(total: Int) {
        check(total > 0) { "Order total is zero" }
    }
}
