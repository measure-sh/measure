package sh.measure.android.fakes

import sh.measure.android.utils.Randomizer

internal class FakeRandomizer : Randomizer {
    var randomDouble: Double
        get() = 1.0
        set(value) {
            require(value in 0.0..1.0)
        }

    var randomLong: Long = 100L

    override fun random(): Double {
        return randomDouble
    }

    override fun nextLong(): Long {
        return randomLong
    }
}
