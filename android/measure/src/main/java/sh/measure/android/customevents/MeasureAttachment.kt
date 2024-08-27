package sh.measure.android.customevents

class MeasureAttachment(
    val name: String,
    val type: String,
    val path: String,
) {
    init {
        require(path.isNotEmpty()) {
            "Attachment path cannot be empty"
        }
    }
}