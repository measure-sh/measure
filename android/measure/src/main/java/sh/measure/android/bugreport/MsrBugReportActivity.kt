package sh.measure.android.bugreport

import android.Manifest.permission.READ_EXTERNAL_STORAGE
import android.Manifest.permission.READ_MEDIA_IMAGES
import android.Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.text.InputFilter
import android.view.View
import android.widget.EditText
import android.widget.HorizontalScrollView
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.annotation.RequiresApi
import androidx.core.content.IntentCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import sh.measure.android.Measure
import sh.measure.android.R
import sh.measure.android.bugreport.BugReportCollector.Companion.INITIAL_SCREENSHOT_EXTRA
import sh.measure.android.bugreport.BugReportCollector.Companion.MAX_ATTACHMENTS_EXTRA
import sh.measure.android.bugreport.BugReportCollector.Companion.MAX_DESCRIPTION_LENGTH
import sh.measure.android.bugreport.BugReportCollector.Companion.PICK_IMAGES_REQUEST
import sh.measure.android.bugreport.BugReportCollector.Companion.READ_IMAGES_PERMISSION_REQUEST
import sh.measure.android.utils.isPermissionDeclared

internal class MsrBugReportActivity : Activity() {
    private lateinit var etDescription: EditText
    private lateinit var slScreenshotsContainer: LinearLayout
    private lateinit var tvChooseImage: TextView
    private lateinit var btnClose: ImageButton
    private lateinit var tvSend: TextView
    private lateinit var hsvScreenshots: HorizontalScrollView
    private lateinit var bugReportCollector: BugReportCollector
    private var maxAttachments: Int = 1
    private var uris: MutableSet<Uri> = mutableSetOf()
    private var attachments: MutableSet<ParcelableAttachment> = mutableSetOf()
    private val totalAttachments: Int get() = attachments.size + uris.size

    companion object {
        private const val PARCEL_SCREENSHOTS = "parcel_screenshots"
        private const val PARCEL_URIS = "parcel_uris"

        fun launch(
            context: Context,
            initialScreenshot: ParcelableAttachment? = null,
            maxAttachmentsInBugReport: Int,
            maxDescriptionLengthInBugReport: Int,
        ) {
            val intent = Intent(context, MsrBugReportActivity::class.java)
            initialScreenshot?.let {
                intent.putExtra(INITIAL_SCREENSHOT_EXTRA, it)
            }
            intent.putExtra(MAX_ATTACHMENTS_EXTRA, maxAttachmentsInBugReport)
            intent.putExtra(MAX_DESCRIPTION_LENGTH, maxDescriptionLengthInBugReport)
            context.startActivity(intent)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
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

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putParcelableArray(PARCEL_SCREENSHOTS, attachments.toTypedArray())
        outState.putParcelableArray(PARCEL_URIS, uris.toTypedArray())
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        when (requestCode) {
            PICK_IMAGES_REQUEST -> {
                val maxAllowedSelections = maxAttachments - totalAttachments
                val selectedUris = bugReportCollector.onImagePickedResult(
                    this,
                    resultCode,
                    data,
                    maxAllowedSelections,
                )
                handleSelectedUris(selectedUris)
            }
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        when (requestCode) {
            READ_IMAGES_PERMISSION_REQUEST -> {
                if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    val maxAllowedSelections = maxAttachments - totalAttachments
                    bugReportCollector.launchImagePicker(this, maxAllowedSelections)
                } else {
                    Toast.makeText(
                        this,
                        "Photos access needed to attach screenshots",
                        Toast.LENGTH_LONG,
                    ).show()
                }
            }
        }
    }

    private fun setupInitialState(savedInstanceState: Bundle?) {
        bugReportCollector = Measure.getBugReportCollector()
        maxAttachments = intent.getIntExtra(MAX_ATTACHMENTS_EXTRA, 1)
        tvChooseImage.visibility = if (canAccessGalleryImages()) View.VISIBLE else View.GONE
        if (savedInstanceState == null) {
            showInitialScreenshot()
        } else {
            restoreState(savedInstanceState)
            restoreViews()
        }
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
            bugReportCollector.validateBugReport(attachments.size, etDescription.text.length)
        if (isValid) {
            trackBugReport()
            finish()
        }
    }

    private fun showInitialScreenshot() {
        val screenshot = getInitialScreenshot() ?: return
        attachments.add(screenshot)
        addAttachmentView(screenshot)
    }

    private fun getInitialScreenshot(): ParcelableAttachment? = IntentCompat.getParcelableExtra(
        intent,
        INITIAL_SCREENSHOT_EXTRA,
        ParcelableAttachment::class.java,
    )

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
            PARCEL_SCREENSHOTS,
            ParcelableAttachment::class.java,
        )?.let { attachments.addAll(it.toList()) }

        savedInstanceState.getParcelableArray(PARCEL_URIS, Uri::class.java)
            ?.let { uris.addAll(it.toList()) }
    }

    @Suppress("DEPRECATION")
    private fun restoreStateLegacy(savedInstanceState: Bundle) {
        savedInstanceState.getParcelableArray(PARCEL_SCREENSHOTS)
            ?.let { attachments.addAll(it.filterIsInstance<ParcelableAttachment>()) }

        savedInstanceState.getParcelableArray(PARCEL_URIS)
            ?.let { uris.addAll(it.filterIsInstance<Uri>()) }
    }

    private fun restoreViews() {
        attachments.forEach { attachment -> addAttachmentView(attachment) }
        uris.forEach { uri -> addUriView(uri) }
        updateAddImageClickListener()
    }

    private fun addAttachmentView(attachment: ParcelableAttachment) {
        ScreenshotView(this).apply {
            setImageFromPath(attachment.path)
            setRemoveClickListener {
                attachments.remove(attachment)
                slScreenshotsContainer.removeView(this)
                updateAddImageClickListener()
            }
            slScreenshotsContainer.addView(this)
        }
    }

    private fun addUriView(uri: Uri) {
        ScreenshotView(this).apply {
            setImageFromUri(uri)
            setRemoveClickListener {
                uris.remove(uri)
                slScreenshotsContainer.removeView(this)
                updateAddImageClickListener()
            }
            slScreenshotsContainer.addView(this)
        }
    }

    private fun handleSelectedUris(selectedUris: List<Uri>) {
        if (totalAttachments + selectedUris.size > maxAttachments) {
            showMaxAttachmentsToast()
        } else {
            val maxAllowed = maxAttachments - totalAttachments
            val newUris = selectedUris.filter { it !in uris }.take(maxAllowed)
            uris.addAll(newUris)
            showSelectedImages(newUris)
        }
        updateAddImageClickListener()
    }

    private fun showSelectedImages(uris: List<Uri>) {
        uris.forEach { addUriView(it) }
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
                bugReportCollector.launchImagePicker(this, maxAllowedSelections)
            }
        }
    }

    private fun trackBugReport() {
        bugReportCollector.track(
            this,
            etDescription.text.toString(),
            attachments.toList(),
            uris.toList(),
        )
    }

    private fun canAccessGalleryImages(): Boolean = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        isPermissionDeclared(
            this,
            READ_MEDIA_VISUAL_USER_SELECTED,
        ) ||
            isPermissionDeclared(this, READ_MEDIA_IMAGES)
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        isPermissionDeclared(this, READ_MEDIA_IMAGES)
    } else {
        isPermissionDeclared(this, READ_EXTERNAL_STORAGE)
    }
}
