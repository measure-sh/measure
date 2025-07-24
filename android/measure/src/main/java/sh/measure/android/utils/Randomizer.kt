package sh.measure.android.utils

import java.util.Random

internal interface Randomizer {
    /**
     * Returns a random number between 0.0 and 1.0.
     */
    fun random(): Double

    /**
     * Returns the next pseudorandom, uniformly distributed long value.
     */
    fun nextLong(): Long
}

internal class RandomizerImpl : Randomizer {
    private val random: Random by lazy(LazyThreadSafetyMode.SYNCHRONIZED) { Random() }

    override fun random(): Double = Math.random()

    override fun nextLong(): Long = random.nextLong()
}
