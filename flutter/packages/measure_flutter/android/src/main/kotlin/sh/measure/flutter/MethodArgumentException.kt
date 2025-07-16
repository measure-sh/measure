package sh.measure.flutter

class MethodArgumentException(
    val code: String,
    override val message: String,
    val details: String
) : Exception(message)
