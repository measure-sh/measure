package sh.measure.android.bugreport

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.text.InputFilter
import android.util.Log
import android.view.View
import android.widget.EditText
import android.widget.HorizontalScrollView
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts.PickMultipleVisualMedia
import androidx.activity.result.contract.ActivityResultContracts.PickVisualMedia
import androidx.annotation.RequiresApi
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import sh.measure.android.Measure
import sh.measure.android.R
import sh.measure.android.bugreport.BugReportCollector.Companion.MAX_ATTACHMENTS_EXTRA
import sh.measure.android.bugreport.BugReportCollector.Companion.MAX_DESCRIPTION_LENGTH

internal class MsrBugReportActivity : ComponentActivity() {
    private lateinit var etDescription: EditText
    private lateinit var slScreenshotsContainer: LinearLayout
    private lateinit var tvChooseImage: TextView
    private lateinit var btnClose: ImageButton
    private lateinit var tvSend: TextView
    private lateinit var hsvScreenshots: HorizontalScrollView
    private lateinit var bugReportCollector: BugReportCollector
    private var session: BugReportSession? = null
    private var captureView: ScreenshotView? = null
    private var maxAttachments: Int = 1
    private val attachments: MutableList<BugReportAttachment> = mutableListOf()
    private val totalAttachments: Int get() = attachments.size

    private val pickMultipleMedia =
        registerForActivityResult(PickMultipleVisualMedia()) { selectedUris ->
            handleSelectedUris(selectedUris)
        }

    private val pickSingleMedia = registerForActivityResult(PickVisualMedia()) { uri ->
        uri?.let { handleSelectedUris(listOf(it)) }
    }

    companion object {
        private const val PARCEL_ATTACHMENTS = "parcel_attachments"

        fun launch(
            context: Context,
            maxAttachmentsInBugReport: Int,
            maxDescriptionLengthInBugReport: Int,
        ) {
            val intent = Intent(context, MsrBugReportActivity::class.java)
            intent.putExtra(MAX_ATTACHMENTS_EXTRA, maxAttachmentsInBugReport)
            intent.putExtra(MAX_DESCRIPTION_LENGTH, maxDescriptionLengthInBugReport)
            context.startActivity(intent)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        bugReportCollector = Measure.getBugReportCollector()
        setContentView(R.layout.msr_bug_report_activity)
        handleEdgeToEdgeDisplay()
        initViews()
        setupInitialState(savedInstanceState)
    }

    override fun onResume() {
        super.onResume()
        bugReportCollector.setBugReportFlowActive()
    }

    override fun onPause() {
        super.onPause()
        bugReportCollector.setBugReportFlowInactive()
    }

    override fun onDestroy() {
        super.onDestroy()
        session?.screenshot?.setListener(null)
        if (isFinishing) {
            session?.let { bugReportCollector.discardSession(it) }
        }
        session = null
        captureView = null
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putParcelableArray(PARCEL_ATTACHMENTS, attachments.toTypedArray())
    }

    private fun setupInitialState(savedInstanceState: Bundle?) {
        session = bugReportCollector.getSession()
        maxAttachments = intent.getIntExtra(MAX_ATTACHMENTS_EXTRA, 1)
        tvChooseImage.visibility = View.VISIBLE
        if (savedInstanceState != null) {
            restoreState(savedInstanceState)
        }
        reconcileCapture(isRestored = savedInstanceState != null)
        addAttachmentViews()
    }

    private fun initViews() {
        initializeBasicViews()
        setupDescriptionField()
        setupButtons()
    }

    private fun handleEdgeToEdgeDisplay() {
        val container = findViewById<LinearLayout>(R.id.ll_bug_report_container)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            ViewCompat.setOnApplyWindowInsetsListener(container) { view, windowInsets ->
                val insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars())
                view.updatePadding(
                    left = insets.left,
                    top = insets.top,
                    right = insets.right,
                    bottom = insets.bottom,
                )
                windowInsets
            }
        } else {
            ViewCompat.setOnApplyWindowInsetsListener(container) { view, windowInsets ->
                @Suppress("DEPRECATION")
                val insets = windowInsets.systemWindowInsets
                view.updatePadding(
                    left = insets.left,
                    top = insets.top,
                    right = insets.right,
                    bottom = insets.bottom,
                )
                windowInsets
            }
        }
    }

    private fun initializeBasicViews() {
        hsvScreenshots = findViewById(R.id.hsv_screenshots)
        etDescription = findViewById(R.id.et_description)
        slScreenshotsContainer = findViewById(R.id.sl_screenshots_container)
        tvChooseImage = findViewById(R.id.tv_choose_image)
        btnClose = findViewById(R.id.btn_close)
        tvSend = findViewById(R.id.tv_send)
    }

    private fun setupDescriptionField() {
        val maxDescriptionLength = intent.getIntExtra(MAX_DESCRIPTION_LENGTH, 4000)
        etDescription.filters = arrayOf(InputFilter.LengthFilter(maxDescriptionLength))
    }

    private fun setupButtons() {
        btnClose.setOnClickListener { finish() }
        tvSend.setOnClickListener {
            sendBugReport()
        }
        updateAddImageClickListener()
    }

    private fun sendBugReport() {
        val isValid =
            bugReportCollector.validateBugReport(totalAttachments, etDescription.text.length)
        if (isValid) {
            trackBugReport()
            finish()
        } else {
            Log.e(
                "Measure",
                "Failed to send bug report, either description or attachments must be set",
            )
        }
    }

    private fun restoreState(savedInstanceState: Bundle) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            restoreStateApi33(savedInstanceState)
        } else {
            restoreStateLegacy(savedInstanceState)
        }
    }

    @RequiresApi(Build.VERSION_CODES.TIRAMISU)
    private fun restoreStateApi33(savedInstanceState: Bundle) {
        savedInstanceState.getParcelableArray(
            PARCEL_ATTACHMENTS,
            BugReportAttachment::class.java,
        )?.let { attachments.addAll(it.toList()) }
    }

    @Suppress("DEPRECATION")
    private fun restoreStateLegacy(savedInstanceState: Bundle) {
        savedInstanceState.getParcelableArray(PARCEL_ATTACHMENTS)
            ?.let { attachments.addAll(it.filterIsInstance<BugReportAttachment>()) }
    }

    private fun reconcileCapture(isRestored: Boolean) {
        if (!isRestored) {
            when (val encoded = session?.screenshot?.encoded) {
                null -> if (session?.screenshot?.isPreparing() == true) {
                    attachments.add(BugReportAttachment.Capture)
                }

                else -> attachments.add(
                    BugReportAttachment.Screenshot(encoded.name, encoded.path),
                )
            }
            return
        }
        val index = attachments.indexOf(BugReportAttachment.Capture)
        if (index < 0) {
            return
        }
        val slot = session?.screenshot
        val encoded = slot?.encoded
        when {
            encoded != null -> attachments[index] =
                BugReportAttachment.Screenshot(encoded.name, encoded.path)

            slot?.isPreparing() == true -> Unit
            else -> attachments.removeAt(index)
        }
    }

    private fun addAttachmentViews() {
        attachments.forEach { attachment -> addAttachmentView(attachment) }
        updateAddImageClickListener()
    }

    private fun addAttachmentView(attachment: BugReportAttachment) {
        val view = ScreenshotView(this)
        when (attachment) {
            BugReportAttachment.Capture -> {
                val slot = session?.screenshot
                slot?.preview?.let { view.setImageFromBitmap(it) }
                captureView = view
                if (slot != null && slot.isPreparing()) {
                    slot.setListener(::onScreenshotEncoded)
                }
            }

            is BugReportAttachment.Screenshot -> view.setImageFromPath(attachment.path)
            is BugReportAttachment.Image -> view.setImageFromUri(attachment.uri)
        }
        view.setRemoveClickListener { removeAttachment(attachment, view) }
        slScreenshotsContainer.addView(view)
    }

    private fun removeAttachment(attachment: BugReportAttachment, view: ScreenshotView) {
        attachments.remove(attachment)
        if (isSessionCapture(attachment)) {
            captureView = null
            session?.screenshot?.setListener(null)
            session?.let { bugReportCollector.discardScreenshot(it) }
        }
        slScreenshotsContainer.removeView(view)
        updateAddImageClickListener()
    }

    private fun isSessionCapture(attachment: BugReportAttachment): Boolean = when (attachment) {
        BugReportAttachment.Capture -> true
        is BugReportAttachment.Screenshot -> attachment.path == session?.screenshot?.encoded?.path
        is BugReportAttachment.Image -> false
    }

    private fun onScreenshotEncoded(encoded: EncodedScreenshot?) {
        val index = attachments.indexOf(BugReportAttachment.Capture)
        if (index < 0) {
            return
        }
        val view = captureView
        captureView = null
        if (encoded == null) {
            attachments.removeAt(index)
            view?.let { slScreenshotsContainer.removeView(it) }
            updateAddImageClickListener()
            return
        }
        val screenshot = BugReportAttachment.Screenshot(encoded.name, encoded.path)
        attachments[index] = screenshot
        view ?: return
        view.setRemoveClickListener { removeAttachment(screenshot, view) }
    }

    private fun handleSelectedUris(selectedUris: List<Uri>) {
        if (totalAttachments + selectedUris.size > maxAttachments) {
            showMaxAttachmentsToast()
        } else {
            val maxAllowed = maxAttachments - totalAttachments
            val existingUris =
                attachments.filterIsInstance<BugReportAttachment.Image>().map { it.uri }
            val newUris =
                selectedUris.distinct().filter { it !in existingUris }.take(maxAllowed)

            // Take persistent URI permissions to prevent SecurityException when reading the image.
            newUris.forEach { uri ->
                try {
                    contentResolver.takePersistableUriPermission(
                        uri,
                        Intent.FLAG_GRANT_READ_URI_PERMISSION,
                    )
                } catch (e: Exception) {
                    // Some URIs may not support persistent permissions, this is expected and
                    // should not prevent processing
                    Log.e(
                        "Measure",
                        "Failed to take persistent URI permission for $uri, attachment will be skipped",
                    )
                }
            }

            newUris.forEach { uri ->
                val attachment = BugReportAttachment.Image(uri)
                attachments.add(attachment)
                addAttachmentView(attachment)
            }
        }
        updateAddImageClickListener()
    }

    private fun showMaxAttachmentsToast() {
        Toast.makeText(
            this,
            "Maximum of $maxAttachments images can be added",
            Toast.LENGTH_LONG,
        ).show()
    }

    private fun updateAddImageClickListener() {
        tvChooseImage.setOnClickListener {
            if (totalAttachments == maxAttachments) {
                showMaxAttachmentsToast()
            } else {
                val maxAllowedSelections = maxAttachments - totalAttachments
                launchImagePicker(maxAllowedSelections)
            }
        }
    }

    private fun launchImagePicker(maxAllowedSelections: Int) {
        if (maxAllowedSelections == 1) {
            pickSingleMedia.launch(PickVisualMediaRequest(PickVisualMedia.ImageOnly))
        } else {
            pickMultipleMedia.launch(PickVisualMediaRequest(PickVisualMedia.ImageOnly))
        }
    }

    private fun trackBugReport() {
        bugReportCollector.track(
            this,
            etDescription.text.toString(),
            attachments.toList(),
        )
    }
}
