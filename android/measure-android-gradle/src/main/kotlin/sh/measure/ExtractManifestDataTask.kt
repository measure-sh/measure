package sh.measure

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.encodeToStream
import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.TaskAction
import org.w3c.dom.Document
import org.w3c.dom.Element
import org.w3c.dom.Node
import javax.xml.parsers.DocumentBuilder
import javax.xml.parsers.DocumentBuilderFactory

private const val KEY_VERSION_CODE = "android:versionCode"
private const val KEY_VERSION_NAME = "android:versionName"
private const val KEY_PACKAGE = "package"
private const val KEY_API_KEY = "sh.measure.android.API_KEY"
private const val KEY_API_URL = "sh.measure.android.API_URL"
private const val TAG_MANIFEST = "manifest"
private const val TAG_META_DATA = "meta-data"
private const val ATTR_ANDROID_NAME = "android:name"
private const val ATTR_ANDROID_VALUE = "android:value"

abstract class ExtractManifestDataTask : DefaultTask() {
    init {
        group = MeasurePlugin.GROUP_NAME
        description = "Parses and writes manifest data to a file"
    }

    @get:InputFile
    abstract val manifestInputProperty: RegularFileProperty

    @get:OutputFile
    abstract val manifestOutputProperty: RegularFileProperty

    @TaskAction
    @Throws(GradleException::class)
    fun extractManifestData() {
        val inputFile = manifestInputProperty.get().asFile
        val outputFile = manifestOutputProperty.get().asFile

        val dbFactory: DocumentBuilderFactory = DocumentBuilderFactory.newInstance()
        val dBuilder: DocumentBuilder = dbFactory.newDocumentBuilder()
        val doc = dBuilder.parse(inputFile.inputStream())
        doc.documentElement.normalize()
        val versionCode = extractVersionCode(doc)
            ?: throw GradleException("$KEY_VERSION_CODE not found in manifest")
        val versionName = extractVersionName(doc)
            ?: throw GradleException("$KEY_VERSION_NAME name not found in manifest")
        val packageName =
            extractPackageName(doc) ?: throw GradleException("$KEY_PACKAGE not found in manifest")
        val apiKey = extractApiKey(doc)
        val apiUrl = extractApiUrl(doc)

        if (apiKey == null) {
            logger.error(
                "[ERROR]: $KEY_API_KEY missing in manifest, Measure SDK will not be initialized.",
            )
            return
        }

        if (apiUrl == null) {
            logger.error(
                "[ERROR]: $KEY_API_URL missing in manifest, Measure SDK will not be initialized.",
            )
            return
        }

        @Suppress("OPT_IN_USAGE")
        Json.encodeToStream(
            ManifestData(
                versionCode = versionCode,
                versionName = versionName,
                appUniqueId = packageName,
                apiKey = apiKey,
                apiUrl = apiUrl,
            ),
            outputFile.outputStream(),
        )
    }

    private fun extractPackageName(doc: Document): String? = doc.getElementsByTagName(TAG_MANIFEST)
        .item(0).attributes.getNamedItem(KEY_PACKAGE).nodeValue

    private fun extractVersionName(doc: Document): String? = doc.getElementsByTagName(TAG_MANIFEST)
        .item(0).attributes.getNamedItem(KEY_VERSION_NAME).nodeValue

    private fun extractVersionCode(doc: Document): String? = doc.getElementsByTagName(TAG_MANIFEST)
        .item(0).attributes.getNamedItem(KEY_VERSION_CODE).nodeValue

    private fun extractApiKey(doc: Document): String? {
        val metaDataNodes = doc.getElementsByTagName(TAG_META_DATA)
        return (0 until metaDataNodes.length).asSequence().map { metaDataNodes.item(it) }
            .filter { it.nodeType == Node.ELEMENT_NODE }.map { it as Element }
            .firstOrNull { it.getAttribute(ATTR_ANDROID_NAME) == KEY_API_KEY }
            ?.getAttribute(ATTR_ANDROID_VALUE)
    }

    private fun extractApiUrl(doc: Document): String? {
        val metaDataNodes = doc.getElementsByTagName(TAG_META_DATA)
        return (0 until metaDataNodes.length).asSequence().map { metaDataNodes.item(it) }
            .filter { it.nodeType == Node.ELEMENT_NODE }.map { it as Element }
            .firstOrNull { it.getAttribute(ATTR_ANDROID_NAME) == KEY_API_URL }
            ?.getAttribute(ATTR_ANDROID_VALUE)
    }
}
