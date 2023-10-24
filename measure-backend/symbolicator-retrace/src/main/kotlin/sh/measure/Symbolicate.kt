package sh.measure

import com.amazonaws.auth.AWSStaticCredentialsProvider
import com.amazonaws.auth.BasicAWSCredentials
import com.amazonaws.services.s3.AmazonS3
import com.amazonaws.services.s3.AmazonS3ClientBuilder
import com.android.tools.r8.retrace.ProguardMapProducer
import com.android.tools.r8.retrace.RetraceOptions
import com.android.tools.r8.retrace.RetraceStackTraceContext
import com.android.tools.r8.retrace.StringRetrace
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File
import java.nio.file.Path

fun Route.symbolicate() {
    val env = environment!!
    val s3Region = env.config.property("s3.symbols_s3_bucket_region").getString()
    val s3Bucket = env.config.property("s3.symbols_s3_bucket").getString()
    val symbolsAccessKey = env.config.property("s3.symbols_access_key").getString()
    val symbolsSecretKey = env.config.property("s3.symbols_secret_access_key").getString()

    post("/symbolicate") {
        val request = call.receive<SymbolicateRequest>()
        val s3 = configureS3(s3Region, symbolsAccessKey, symbolsSecretKey)
        val mappingFile = downloadMappingFile(call, s3, request, s3Bucket) ?: return@post
        val stringRetrace = createStringRetrace(mappingFile.toPath())
        val retraced = request.data.map { dataUnit ->
            dataUnit.copy(
                values = stringRetrace.retrace(dataUnit.values, RetraceStackTraceContext.empty()).lines
            )
        }
        mappingFile.delete()
        call.respondText(Json.encodeToString(retraced), ContentType.Application.Json, HttpStatusCode.OK)
    }
}

private fun createStringRetrace(mappingFilePath: Path): StringRetrace = StringRetrace.create(
    RetraceOptions.builder().setProguardMapProducer(ProguardMapProducer.fromPath(mappingFilePath)).build()
)

private suspend fun downloadMappingFile(
    call: ApplicationCall, s3: AmazonS3, request: SymbolicateRequest, s3Bucket: String
): File? = DownloadMapping(call, s3).download(s3Bucket = s3Bucket, key = request.key)

private fun configureS3(s3BucketRegion: String, symbolsAccessKey: String, symbolsSecretKey: String): AmazonS3 {
    val basicAWSCredentials = BasicAWSCredentials(symbolsAccessKey, symbolsSecretKey)
    val credentialsProvider = AWSStaticCredentialsProvider(basicAWSCredentials)
    return AmazonS3ClientBuilder.standard().withCredentials(credentialsProvider).withRegion(s3BucketRegion).build()
}
