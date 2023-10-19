package sh.measure.plugins

import io.ktor.server.application.*
import io.ktor.server.plugins.requestvalidation.*
import sh.measure.SymbolicateRequest

fun Application.configureRequestValidation() {
    install(RequestValidation) {
        validate<SymbolicateRequest> { request ->
            if (request.data.isEmpty()) {
                ValidationResult.Invalid("Symbolication data must not be an empty array")
            }
            if (request.key.isBlank()) {
                ValidationResult.Invalid("Mapping file key must not be empty")
            } else {
                ValidationResult.Valid
            }
        }
    }
}
