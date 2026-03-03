package sh.measure.sample

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.widget.ScrollView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import com.google.android.material.switchmaterial.SwitchMaterial
import com.google.android.material.textview.MaterialTextView
import sh.measure.android.Measure
import sh.measure.android.attributes.AttributesBuilder
import sh.measure.android.bugreport.MsrShakeListener
import sh.measure.android.tracing.SpanStatus
import sh.measure.sample.fragments.AndroidXFragmentNavigationActivity
import sh.measure.sample.fragments.FragmentNavigationActivity
import sh.measure.sample.fragments.NestedFragmentActivity
import sh.measure.sample.screenshot.ComposeScreenshotActivity
import sh.measure.sample.screenshot.ViewScreenshotActivity
import java.io.IOException
import kotlin.concurrent.thread

class ExceptionDemoActivity : AppCompatActivity(), MsrShakeListener {
    private val _mutex = Any()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val span = Measure.startSpan("activity.onCreate")
        setContentView(R.layout.activity_exception_demo)
        handleEdgeToEdgeDisplay()
        findViewById<MaterialTextView>(R.id.btn_configure_credentials).setOnClickListener {
            startActivity(Intent(this, ConfigureCredentialsActivity::class.java))
        }
        findViewById<MaterialTextView>(R.id.btn_single_exception).setOnClickListener {
            throw IllegalAccessException("This is a new exception")
        }
        findViewById<MaterialTextView>(R.id.btn_chained_exception).setOnClickListener {
            throw IOException("This is a test exception").initCause(
                CustomException(message = "This is a nested custom exception")
            )
        }
        findViewById<MaterialTextView>(R.id.btn_oom_exception).setOnClickListener {
            val list = mutableListOf<ByteArray>()
            while (true) {
                val byteArray = ByteArray(1024 * 1024 * 100) // Allocate 100MB of memory
                list.add(byteArray)
            }
        }
        findViewById<MaterialTextView>(R.id.btn_stack_overflow_exception).setOnClickListener {
            recursiveFunction()
        }
        findViewById<MaterialTextView>(R.id.btn_infinite_loop).setOnClickListener {
            infiniteLoop()
        }
        findViewById<MaterialTextView>(R.id.btn_deadlock).setOnClickListener {
            deadLock()
        }
        findViewById<MaterialTextView>(R.id.btn_okhttp).setOnClickListener {
            startActivity(Intent(this, OkHttpActivity::class.java))
        }
        findViewById<MaterialTextView>(R.id.btn_compose).setOnClickListener {
            startActivity(Intent(this, ComposeActivity::class.java))
        }
        findViewById<MaterialTextView>(R.id.btn_compose_navigation).setOnClickListener {
            startActivity(Intent(this, ComposeNavigationActivity::class.java))
        }
        findViewById<MaterialTextView>(R.id.btn_view_screenshot).setOnClickListener {
            startActivity(Intent(this, ViewScreenshotActivity::class.java))
        }
        findViewById<MaterialTextView>(R.id.btn_compose_screenshot).setOnClickListener {
            startActivity(Intent(this, ComposeScreenshotActivity::class.java))
        }
        findViewById<MaterialTextView>(R.id.btn_nested_fragments).setOnClickListener {
            startActivity(Intent(this, NestedFragmentActivity::class.java))
        }
        findViewById<MaterialTextView>(R.id.btn_fragment_navigation).setOnClickListener {
            startActivity(Intent(this, FragmentNavigationActivity::class.java))
        }
        findViewById<MaterialTextView>(R.id.btn_fragment_androidx_navigation).setOnClickListener {
            startActivity(Intent(this, AndroidXFragmentNavigationActivity::class.java))
        }
        findViewById<MaterialTextView>(R.id.btn_launch_bug_report).setOnClickListener {
            val attributes = AttributesBuilder().put("is_premium", true).build()
            Measure.launchBugReportActivity(attributes = attributes)
        }
        val enableShakeSwitch = findViewById<SwitchMaterial>(R.id.btn_enable_shake)
        enableShakeSwitch.isChecked = false
        enableShakeSwitch.setOnCheckedChangeListener { _, isChecked ->
            when (isChecked) {
                true -> {
                    Measure.setShakeListener(this@ExceptionDemoActivity)
                }

                false -> {
                    Measure.setShakeListener(null)
                }
            }
        }
        val customShakeSwitch = findViewById<SwitchMaterial>(R.id.switch_custom_shake_handler)
        customShakeSwitch.isChecked = false
        customShakeSwitch.setOnCheckedChangeListener { _, isChecked ->
            when (isChecked) {
                true -> {
                    Measure.setShakeListener(object : MsrShakeListener {
                        override fun onShake() {
                            Toast.makeText(
                                this@ExceptionDemoActivity,
                                "Custom shake handler",
                                Toast.LENGTH_SHORT
                            ).show()
                            Measure.launchBugReportActivity(false)
                        }
                    })
                }

                false -> {
                    Measure.setShakeListener(null)
                }
            }
        }
        findViewById<MaterialTextView>(R.id.btn_bug_report).setOnClickListener {
            Measure.captureLayoutSnapshot(this, onComplete = { snapshot ->
                Measure.trackBugReport(
                    "Custom bug report",
                    attachments = listOf(snapshot),
                    attributes = AttributesBuilder().put("is_premium", true).build()
                )
            })
        }
        val spanButton = findViewById<MaterialTextView>(R.id.btn_generate_span)
        spanButton.setOnClickListener {
            spanButton.isEnabled = false
            thread {
                val rootSpan = Measure.startSpan("root")
                rootSpan.setAttribute("user_segment_premium", true)
                val startTime = Measure.getCurrentTime()
                Thread.sleep(1000)
                val interestsSpan = Measure.startSpan("screen.interests").setParent(rootSpan)
                Thread.sleep(1000)
                val forYou = Measure.startSpan("screen.for_you").setParent(rootSpan)
                Thread.sleep(1000)
                interestsSpan.end()
                Thread.sleep(1000)
                forYou.end()
                Measure.startSpan("http", timestamp = startTime).setParent(rootSpan).end()
                Measure.startSpan("screen.main", timestamp = startTime).setParent(rootSpan).end()
                rootSpan.end()
                runOnUiThread {
                    spanButton.isEnabled = true
                }
            }
        }
        val sdkSwitch = findViewById<SwitchMaterial>(R.id.btn_sdk_switch)
        sdkSwitch.isChecked = true
        sdkSwitch.setOnCheckedChangeListener { _, isChecked ->
            when (isChecked) {
                true -> {
                    Measure.start()
                }

                false -> {
                    Measure.stop()
                }
            }
        }

        val userSwitch = findViewById<SwitchMaterial>(R.id.switch_set_user)
        userSwitch.isChecked = false
        userSwitch.setOnCheckedChangeListener { _, isChecked ->
            when (isChecked) {
                true -> {
                    Measure.setUserId("dummy-user-id")
                }

                false -> {
                    Measure.clearUserId()
                }
            }
        }


        span.setStatus(SpanStatus.Ok).end()
    }

    private fun infiniteLoop() {
        while (true) {
            // Do nothing
        }
    }

    private fun recursiveFunction() {
        recursiveFunction()
    }

    private fun deadLock() {
        LockerThread().start()
        Handler(Looper.getMainLooper()).postDelayed({
            synchronized(_mutex) {
                Log.e(
                    "Measure", "There should be a dead lock before this message"
                )
            }
        }, 1000)
    }

    inner class LockerThread internal constructor() : Thread() {
        init {
            name = "APP: Locker"
        }

        override fun run() {
            synchronized(_mutex) { while (true) sleep() }
        }
    }

    private fun sleep() {
        try {
            Thread.sleep((8 * 1000).toLong())
        } catch (e: InterruptedException) {
            e.printStackTrace()
        }
    }

    private fun handleEdgeToEdgeDisplay() {
        val container = findViewById<ScrollView>(R.id.sv_container)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            ViewCompat.setOnApplyWindowInsetsListener(container) { view, windowInsets ->
                val insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars())
                view.updatePadding(
                    left = insets.left,
                    top = insets.top,
                    right = insets.right,
                    bottom = insets.bottom
                )
                windowInsets
            }
        } else {
            ViewCompat.setOnApplyWindowInsetsListener(container) { view, windowInsets ->
                @Suppress("DEPRECATION") val insets = windowInsets.systemWindowInsets
                view.updatePadding(
                    left = insets.left,
                    top = insets.top,
                    right = insets.right,
                    bottom = insets.bottom
                )
                windowInsets
            }
        }
    }

    override fun onShake() {
        Measure.launchBugReportActivity(
            true,
            AttributesBuilder().put("custom-key", "value").build()
        )
    }
}

class CustomException(override val message: String? = null) : Exception()