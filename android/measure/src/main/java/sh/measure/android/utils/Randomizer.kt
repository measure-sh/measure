package sh.measure.android.utils

internal interface Randomizer {
    /**
     * Returns a random number between 0.0 and 1.0.
     */
    fun random(): Double
}

internal class RandomizerImpl : Randomizer {
    override fun random(): Double {
        return Math.random()
    }
}
