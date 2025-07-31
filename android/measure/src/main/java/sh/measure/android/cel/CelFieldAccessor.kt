package sh.measure.android.cel

interface CelFieldAccessor {
    fun getField(fieldName: String): Any?
}