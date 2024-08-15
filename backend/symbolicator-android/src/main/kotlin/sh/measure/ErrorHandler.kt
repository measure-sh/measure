package sh.measure

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.response.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

suspend fun ApplicationCall.respondError(status: HttpStatusCode, errorResponse: ErrorResponse) {
    respondText(Json.encodeToString(errorResponse), ContentType.Application.Json, status)
}
