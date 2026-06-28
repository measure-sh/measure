package sh.measure.android.profiling

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters
import okio.GzipSink
import okio.buffer
import okio.sink
import okio.source
import sh.measure.android.exporter.AttachmentPacket
import sh.measure.android.exporter.HttpResponse
import sh.measure.android.exporter.HttpUrlConnectionClient
import sh.measure.android.logger.AndroidLogger
import sh.measure.android.storage.Database
import sh.measure.android.storage.DatabaseImpl
import sh.measure.android.tracing.InternalTrace
import java.io.File
import java.util.concurrent.Callable
import java.util.concurrent.Executors

/**
 * Uploads pending profile traces, reading their descriptors from the SDK database and deleting each
 * row once the upload succeeds or the artifact is permanently undeliverable.
 *
 * Each file is gzip-compressed into a temporary file and uploaded with `Content-Encoding: gzip`.
 *
 * It opens its own database from the application context, so it runs even when the SDK is not
 * initialized in this process. Uploads run [MAX_CONCURRENT_UPLOADS] at a time, capped at
 * [MAX_PROFILES_PER_RUN] per run to stay within the worker execution window; any remainder is drained
 * on a later run.
 */
internal class ProfileUploadWorker(
    context: Context,
    params: WorkerParameters,
) : Worker(context, params) {
    private val logger = AndroidLogger(enabled = false)
    private val httpClient = HttpUrlConnectionClient(logger)

    override fun doWork(): Result {
        val database = DatabaseImpl(applicationContext, logger)
        return try {
            uploadPendingProfiles(database)
        } catch (_: Exception) {
            Result.retry()
        } finally {
            database.close()
        }
    }

    private fun uploadPendingProfiles(database: Database): Result {
        val pending = database.getProfileAttachmentsToUpload(MAX_PROFILES_PER_RUN)
        if (pending.isEmpty()) {
            return Result.success()
        }

        var hasRetries = false
        pending.zip(uploadAll(pending)).forEach { (attachment, result) ->
            when (result) {
                UploadResult.DONE -> database.deleteAttachment(attachment.id)
                UploadResult.RETRY -> hasRetries = true
            }
        }

        val reachedPageLimit = pending.size == MAX_PROFILES_PER_RUN
        return if (hasRetries || reachedPageLimit) Result.retry() else Result.success()
    }

    private fun uploadAll(attachments: List<AttachmentPacket>): List<UploadResult> {
        val pool = Executors.newFixedThreadPool(MAX_CONCURRENT_UPLOADS)
        return try {
            val uploads = attachments.map { attachment -> Callable { upload(attachment) } }
            pool.invokeAll(uploads).map { future ->
                runCatching { future.get() }.getOrDefault(UploadResult.RETRY)
            }
        } finally {
            pool.shutdown()
        }
    }

    private fun upload(attachment: AttachmentPacket): UploadResult {
        val file = File(attachment.path)
        if (!file.exists() || !file.canRead()) {
            return UploadResult.DONE
        }
        return InternalTrace.trace(label = { "msr-upload-profile" }) {
            val compressed = File.createTempFile("profile", ".gz", applicationContext.cacheDir)
            try {
                InternalTrace.trace(label = { "msr-gzip-profile" }) {
                    gzip(from = file, to = compressed)
                }
                val response = httpClient.uploadFile(
                    url = attachment.url,
                    contentType = attachment.contentType,
                    contentEncoding = "gzip",
                    headers = attachment.headers,
                    fileSize = compressed.length(),
                ) { sink ->
                    compressed.source().use { sink.writeAll(it) }
                }
                when (response) {
                    is HttpResponse.Success, is HttpResponse.Error.ClientError -> UploadResult.DONE
                    else -> UploadResult.RETRY
                }
            } finally {
                compressed.delete()
            }
        }
    }

    private fun gzip(from: File, to: File) {
        from.source().use { source ->
            GzipSink(to.sink()).buffer().use { gzipSink ->
                gzipSink.writeAll(source)
            }
        }
    }

    private enum class UploadResult {
        /** Uploaded or undeliverable; delete the row. */
        DONE,

        /** Transient or server failure; keep the row for a later run. */
        RETRY,
    }

    companion object {
        private const val MAX_CONCURRENT_UPLOADS = 3
        private const val MAX_PROFILES_PER_RUN = 32
    }
}
