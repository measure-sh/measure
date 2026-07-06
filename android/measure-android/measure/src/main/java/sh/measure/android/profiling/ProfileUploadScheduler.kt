package sh.measure.android.profiling

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequest
import androidx.work.WorkManager
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import sh.measure.android.exporter.AttachmentPacket
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import java.util.concurrent.TimeUnit

/**
 * Outcome of trying to enqueue a profile upload, telling the caller what to do with the attachment
 * row and file.
 */
internal enum class EnqueueResult {
    /** Work enqueued. Remove the attachment row; leave the file for the worker. */
    ENQUEUED,

    /** Transient failure (e.g. WorkManager unavailable). Keep the row and retry on the next export. */
    RETRY,

    /** The descriptor cannot be carried as input data. Remove the row and the file; give up. */
    DROP,
}

/**
 * Enqueues a durable WorkManager job to upload a single profile artifact. The whole upload
 * descriptor (file path, signed URL, content type, headers) is passed through the work's input data,
 * so the worker never reads the SDK database.
 *
 * References `androidx.work` types directly; only instantiate when WorkManager is on the classpath.
 */
internal class ProfileUploadScheduler(
    private val context: Context,
    private val logger: Logger,
) {
    fun enqueue(attachment: AttachmentPacket): EnqueueResult {
        val headersJson = Json.encodeToString(
            MapSerializer(String.serializer(), String.serializer()),
            attachment.headers,
        )
        val descriptorBytes = attachment.path.length + attachment.url.length + headersJson.length +
            attachment.contentType.length + (attachment.contentEncoding?.length ?: 0) +
            DESCRIPTOR_OVERHEAD_BYTES
        if (descriptorBytes > MAX_DESCRIPTOR_BYTES) {
            logger.log(
                LogLevel.Error,
                "Profile upload descriptor too large (${descriptorBytes}B) for ${attachment.id}",
            )
            return EnqueueResult.DROP
        }

        val data = Data.Builder()
            .putString(ProfileUploadWorker.KEY_FILE_PATH, attachment.path)
            .putString(ProfileUploadWorker.KEY_UPLOAD_URL, attachment.url)
            .putString(ProfileUploadWorker.KEY_CONTENT_TYPE, attachment.contentType)
            .putString(ProfileUploadWorker.KEY_CONTENT_ENCODING, attachment.contentEncoding)
            .putString(ProfileUploadWorker.KEY_HEADERS, headersJson)
            .build()
        val request = OneTimeWorkRequest.Builder(ProfileUploadWorker::class.java)
            .setInputData(data)
            .setConstraints(
                Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build(),
            )
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, BACKOFF_SECONDS, TimeUnit.SECONDS)
            .build()
        return try {
            WorkManager.getInstance(context).enqueueUniqueWork(
                "$UNIQUE_WORK_PREFIX${attachment.id}",
                ExistingWorkPolicy.KEEP,
                request,
            )
            EnqueueResult.ENQUEUED
        } catch (e: Exception) {
            // WorkManager.getInstance throws if the host disabled its default initializer without
            // providing a Configuration.Provider. Degrade rather than crash.
            logger.log(LogLevel.Error, "Failed to enqueue profile upload for ${attachment.id}", e)
            EnqueueResult.RETRY
        }
    }

    companion object {
        private const val UNIQUE_WORK_PREFIX = "sh.measure.android.profile-upload-"
        private const val BACKOFF_SECONDS = 30L

        // WorkManager caps input data at 10 KB; stay under it with room for serialization overhead.
        private const val MAX_DESCRIPTOR_BYTES = 8 * 1024
        private const val DESCRIPTOR_OVERHEAD_BYTES = 256
    }
}
