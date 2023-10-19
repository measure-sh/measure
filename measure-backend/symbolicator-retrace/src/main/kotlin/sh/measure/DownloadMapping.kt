package sh.measure

import com.amazonaws.AmazonServiceException
import com.amazonaws.services.s3.AmazonS3
import com.amazonaws.services.s3.model.GetObjectRequest
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.util.logging.*
import io.ktor.utils.io.errors.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileNotFoundException

private val LOGGER = KtorSimpleLogger("DownloadMapping")

class DownloadMapping(private val call: ApplicationCall, private val s3: AmazonS3) {
    suspend fun download(s3Bucket: String, key: String): File? {
        // create mapping file
        val mappingFile = try {
            withContext(Dispatchers.IO) {
                File.createTempFile(key, "")
            }
        } catch (e: IOException) {
            LOGGER.error("Failed to create mapping file", e)
            call.respondError(
                HttpStatusCode.InternalServerError,
                ErrorResponse("Failed to create mapping file.", details = e.message)
            )
            return null
        }

        // download mapping file
        val request = GetObjectRequest(s3Bucket, key)
        try {
            s3.getObject(request, mappingFile)
            return mappingFile
        } catch (e: AmazonServiceException) {
            LOGGER.error("Failed to download mapping file $key", e)
            mappingFile.delete()
            call.respondError(
                HttpStatusCode.InternalServerError,
                ErrorResponse("Failed to download mapping file $key", details = e.errorMessage)
            )
            return null
        } catch (e: FileNotFoundException) {
            LOGGER.error("Mapping file $key not found", e)
            mappingFile.delete()
            call.respondError(
                HttpStatusCode.InternalServerError, ErrorResponse("Mapping file $key not found.", details = e.message)
            )
            return null
        } catch (e: IOException) {
            LOGGER.error("Failed to download mapping file $key", e)
            mappingFile.delete()
            call.respondError(
                HttpStatusCode.InternalServerError,
                ErrorResponse("Failed to download mapping file $key.", details = e.message)
            )
            return null
        } catch (e: IllegalArgumentException) {
            LOGGER.error("Failed to download mapping file $key", e)
            mappingFile.delete()
            call.respondError(
                HttpStatusCode.InternalServerError,
                ErrorResponse("Failed to download mapping file $key.", details = e.message)
            )
            return null
        }
    }
}
