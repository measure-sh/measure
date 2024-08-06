package sh.measure.android.fakes

import sh.measure.android.utils.Randomizer

internal class FakeRandomizer : Randomizer {
    var randomDouble: Double
        get() = 1.0
        set(value) {
            require(value in 0.0..1.0)
        }

    override fun random(): Double {
        return randomDouble
    }
}
