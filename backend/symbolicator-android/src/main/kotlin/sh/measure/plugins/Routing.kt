package sh.measure.plugins

import io.ktor.server.application.*
import io.ktor.server.routing.*
import sh.measure.ping
import sh.measure.symbolicate

fun Application.configureRouting() {
    routing {
        ping()
        symbolicate()
    }
}
