package sh.measure.fixtures

data class Variant(
    val minifyEnabled: Boolean,
    val buildType: String,
    val flavor: String? = null,
    val dimension: String? = null,
)
