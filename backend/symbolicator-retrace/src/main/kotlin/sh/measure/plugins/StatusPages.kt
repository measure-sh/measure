package sh.measure.plugins

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.plugins.*
import io.ktor.server.plugins.requestvalidation.*
import io.ktor.server.plugins.statuspages.*
import sh.measure.ErrorResponse
import sh.measure.respondError

fun Application.configureStatusPages() {
    install(StatusPages) {
        status(HttpStatusCode.NotFound) { call, _ ->
            call.respondError(
                HttpStatusCode.NotFound, ErrorResponse(error = "Page not found")
            )
        }
        exception<RequestValidationException> { call, cause ->
            call.respondError(
                HttpStatusCode.BadRequest,
                ErrorResponse(error = "Invalid request", details = cause.reasons.joinToString())
            )
        }
        exception<BadRequestException> { call, cause ->
            call.respondError(
                HttpStatusCode.BadRequest, ErrorResponse(error = "Invalid request", details = cause.message)
            )
        }
    }

}

