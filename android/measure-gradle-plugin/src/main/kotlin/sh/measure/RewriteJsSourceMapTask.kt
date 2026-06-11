package sh.measure

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import org.gradle.api.DefaultTask
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.TaskAction

private const val SOURCES_KEY = "sources"
private const val NODE_MODULES = "node_modules"

// The React Native source map's "sources" array holds absolute filesystem paths
// (e.g. /Users/name/app/node_modules/react-native/...), which leak the build
// machine's directory layout once uploaded. node_modules always sits at the
// project root, so we use it to locate that root and rewrite every source to a
// path relative to it.
abstract class RewriteJsSourceMapTask : DefaultTask() {
    init {
        group = MeasurePlugin.GROUP_NAME
        description = "Strips absolute filesystem paths from the React Native source map before upload"
    }

    @get:InputFile
    abstract val sourceMapInputProperty: RegularFileProperty

    @get:OutputFile
    abstract val sourceMapOutputProperty: RegularFileProperty

    @TaskAction
    fun rewrite() {
        val inputFile = sourceMapInputProperty.get().asFile
        val outputFile = sourceMapOutputProperty.get().asFile
        outputFile.parentFile?.mkdirs()

        val root = Json.parseToJsonElement(inputFile.readText()) as? JsonObject
        val sources = root?.get(SOURCES_KEY) as? JsonArray
        if (root == null || sources == null) {
            inputFile.copyTo(outputFile, overwrite = true)
            return
        }

        val sourcePaths = sources.map { (it as? JsonPrimitive)?.contentOrNull }
        val projectRoot = findProjectRoot(sourcePaths)
        if (projectRoot == null) {
            inputFile.copyTo(outputFile, overwrite = true)
            return
        }

        val rewrittenSources = JsonArray(
            sources.zip(sourcePaths) { element, path ->
                if (path == null) element else JsonPrimitive(stripRoot(path, projectRoot))
            },
        )
        val rewritten = JsonObject(root.toMutableMap().apply { put(SOURCES_KEY, rewrittenSources) })
        outputFile.writeText(Json.encodeToString(JsonObject.serializer(), rewritten))
    }

    private fun findProjectRoot(sources: List<String?>): String? {
        for (source in sources) {
            if (source == null) continue
            val index = source.indexOf(NODE_MODULES)
            if (index > 0) {
                return source.substring(0, index).trimEnd('/', '\\')
            }
        }
        return null
    }

    private fun stripRoot(path: String, projectRoot: String): String {
        if (path.startsWith(projectRoot)) {
            return path.substring(projectRoot.length).trimStart('/', '\\')
        }
        return path
    }
}
