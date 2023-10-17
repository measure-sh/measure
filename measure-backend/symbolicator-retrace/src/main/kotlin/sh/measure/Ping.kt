package sh.measure

import io.ktor.server.application.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.ping() {
    get("/ping") {
        call.respondText("pong")
    }
}