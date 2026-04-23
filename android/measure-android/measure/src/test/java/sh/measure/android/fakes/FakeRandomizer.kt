package sh.measure.android.fakes

import sh.measure.android.utils.Randomizer

internal class FakeRandomizer : Randomizer {
    var randomDouble: Double = 1.0
        set(value) {
            require(value in 0.0..1.0)
            field = value
        }

    var randomLong: Long = 100L

    var randomInt: Int = 10

    override fun random(): Double = randomDouble

    override fun nextLong(): Long = randomLong

    override fun nextInt(bound: Int): Int = randomInt
}
