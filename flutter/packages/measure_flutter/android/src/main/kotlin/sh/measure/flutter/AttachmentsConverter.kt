package sh.measure.flutter

import org.json.JSONArray
import sh.measure.android.MsrAttachment

class AttachmentsConverter {
    companion object {
        fun convertAttachments(json: String?): MutableList<MsrAttachment> {
            if (json == null) {
                return mutableListOf()
            }
            val attachments = mutableListOf<MsrAttachment>()
            try {
                val jsonArray = JSONArray(json)
                for (i in 0 until jsonArray.length()) {
                    val jsonObject = jsonArray.getJSONObject(i)

                    val name = jsonObject.getString("name")
                    val path = jsonObject.getString("path")
                    attachments.add(MsrAttachment(name = name, path = path, "screenshot"))
                }
                return attachments
            } catch (e: Exception) {
                throw IllegalArgumentException("Invalid attachments format: ${e.message}", e)
            }
        }
    }
}