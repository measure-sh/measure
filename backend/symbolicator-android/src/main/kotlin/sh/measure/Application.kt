package sh.measure

import io.ktor.server.application.*
import io.ktor.server.netty.*
import sh.measure.plugins.*
import sh.measure.plugins.configureSerialization

fun main(args: Array<String>): Unit = EngineMain.main(args)

fun Application.module() {
    validateEnvVariables()
    configureSerialization()
    configureRequestValidation()
    configureStatusPages()
    configureRouting()
}
