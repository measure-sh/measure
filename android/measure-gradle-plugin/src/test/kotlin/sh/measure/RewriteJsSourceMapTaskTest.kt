package sh.measure

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import org.gradle.api.Project
import org.gradle.internal.impldep.org.junit.Rule
import org.gradle.internal.impldep.org.junit.rules.TemporaryFolder
import org.gradle.testfixtures.ProjectBuilder
import org.junit.Assert
import org.junit.Before
import org.junit.Test
import java.io.File

internal class RewriteJsSourceMapTaskTest {

    @field:Rule
    lateinit var temporaryFolder: TemporaryFolder
    private lateinit var inputFile: File
    private lateinit var outputFile: File
    private lateinit var project: Project
    private lateinit var task: RewriteJsSourceMapTask

    @Before
    fun setup() {
        temporaryFolder = TemporaryFolder()
        temporaryFolder.create()
        inputFile = temporaryFolder.newFile("index.android.bundle.map")
        outputFile = temporaryFolder.newFile("output.map")
    }

    @Test
    fun `strips absolute project root from source paths using node_modules as anchor`() {
        inputFile.writeText(
            """
            {"version":3,"sources":[
                "/Users/jane/app/node_modules/react-native/Libraries/Core/setUpErrorHandling.js",
                "/Users/jane/app/App.tsx"
            ],"sourcesContent":["a","b"],"names":[],"mappings":"AAAA"}
            """.trimIndent(),
        )
        configureTask()
        task.rewrite()

        Assert.assertEquals(
            listOf(
                "node_modules/react-native/Libraries/Core/setUpErrorHandling.js",
                "App.tsx",
            ),
            readSources(outputFile),
        )
    }

    @Test
    fun `preserves other source map fields`() {
        inputFile.writeText(
            """{"version":3,"sources":["/Users/jane/app/node_modules/x.js"],"mappings":"AAAA","names":["foo"]}""",
        )
        configureTask()
        task.rewrite()

        val output = Json.parseToJsonElement(outputFile.readText()) as JsonObject
        Assert.assertEquals("AAAA", (output["mappings"] as JsonPrimitive).content)
        Assert.assertEquals(JsonPrimitive(3), output["version"])
        Assert.assertEquals(listOf("node_modules/x.js"), readSources(outputFile))
    }

    @Test
    fun `leaves sources untouched when no node_modules path is present`() {
        inputFile.writeText(
            """{"version":3,"sources":["App.tsx","src/index.js"],"mappings":"AAAA"}""",
        )
        configureTask()
        task.rewrite()

        Assert.assertEquals(listOf("App.tsx", "src/index.js"), readSources(outputFile))
    }

    @Test
    fun `copies through when sources key is missing`() {
        val content = """{"version":3,"mappings":"AAAA"}"""
        inputFile.writeText(content)
        configureTask()
        task.rewrite()

        Assert.assertEquals(content, outputFile.readText())
    }

    private fun readSources(file: File): List<String?> {
        val root = Json.parseToJsonElement(file.readText()) as JsonObject
        return (root["sources"] as JsonArray).map { (it as JsonPrimitive).contentOrNull }
    }

    private fun configureTask() {
        project = ProjectBuilder.builder().withProjectDir(temporaryFolder.root).build()
        task = project.tasks.create("task", RewriteJsSourceMapTask::class.java)
        task.sourceMapInputProperty.set(inputFile)
        task.sourceMapOutputProperty.set(outputFile)
    }
}
