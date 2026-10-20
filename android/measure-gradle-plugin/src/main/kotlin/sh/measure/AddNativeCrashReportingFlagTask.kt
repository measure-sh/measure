package sh.measure

import org.gradle.api.DefaultTask
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.TaskAction
import javax.xml.parsers.DocumentBuilderFactory
import javax.xml.transform.OutputKeys
import javax.xml.transform.TransformerFactory
import javax.xml.transform.dom.DOMSource
import javax.xml.transform.stream.StreamResult

private const val ANDROID_NAMESPACE = "http://schemas.android.com/apk/res/android"
private const val KEY_NATIVE_CRASH_REPORTING = "sh.measure.android.NATIVE_CRASH_REPORTING"
private const val TAG_APPLICATION = "application"
private const val TAG_META_DATA = "meta-data"

/**
 * Adds a meta-data flag to the merged manifest that turns on native crash
 * reporting in the SDK.
 */
abstract class AddNativeCrashReportingFlagTask : DefaultTask() {
    init {
        group = MeasurePlugin.GROUP_NAME
        description = "Adds the native crash reporting flag to the merged manifest"
    }

    @get:InputFile
    abstract val mergedManifest: RegularFileProperty

    @get:OutputFile
    abstract val updatedManifest: RegularFileProperty

    @TaskAction
    fun addNativeCrashReportingFlag() {
        val factory = DocumentBuilderFactory.newInstance().apply { isNamespaceAware = true }
        val doc = factory.newDocumentBuilder().parse(mergedManifest.get().asFile)
        val application = doc.getElementsByTagName(TAG_APPLICATION).item(0)
        val metaData = doc.createElement(TAG_META_DATA).apply {
            setAttributeNS(ANDROID_NAMESPACE, "android:name", KEY_NATIVE_CRASH_REPORTING)
            setAttributeNS(ANDROID_NAMESPACE, "android:value", "true")
        }
        application.appendChild(metaData)

        val transformer = TransformerFactory.newInstance().newTransformer().apply {
            setOutputProperty(OutputKeys.INDENT, "yes")
        }
        transformer.transform(DOMSource(doc), StreamResult(updatedManifest.get().asFile))
    }
}
