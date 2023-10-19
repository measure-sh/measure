package sh.measure.plugins

import io.ktor.server.application.*

fun Application.validateEnvVariables() {
    val s3Region = environment.config.propertyOrNull("s3.symbols_s3_bucket_region")?.getString()
    val s3Bucket = environment.config.propertyOrNull("s3.symbols_s3_bucket")?.getString()
    val symbolsAccessKey = environment.config.propertyOrNull("s3.symbols_access_key")?.getString()
    val symbolsSecretKey = environment.config.propertyOrNull("s3.symbols_secret_access_key")?.getString()
    val missingVariables = mutableListOf<String>()
    if (s3Region.isNullOrBlank()) missingVariables.add("s3.symbols_s3_bucket_region")
    if (s3Bucket.isNullOrBlank()) missingVariables.add("s3.symbols_s3_bucket")
    if (symbolsAccessKey.isNullOrBlank()) missingVariables.add("s3.symbols_access_key")
    if (symbolsSecretKey.isNullOrBlank()) missingVariables.add("s3.symbols_secret_access_key")

    if (missingVariables.isNotEmpty()) {
        val missingVariableList = missingVariables.joinToString(", ")
        throw IllegalStateException("Missing required environment variables: $missingVariableList")
    }
}