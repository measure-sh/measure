package sh.measure.sample

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.widget.Button
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.switchmaterial.SwitchMaterial
import sh.measure.android.Measure
import sh.measure.android.attributes.AttributesBuilder
import sh.measure.android.tracing.SpanStatus
import sh.measure.sample.fragments.AndroidXFragmentNavigationActivity
import sh.measure.sample.fragments.FragmentNavigationActivity
import sh.measure.sample.fragments.NestedFragmentActivity
import sh.measure.sample.screenshot.ComposeScreenshotActivity
import sh.measure.sample.screenshot.ViewScreenshotActivity
import java.io.IOException
import kotlin.concurrent.thread

class ExceptionDemoActivity : AppCompatActivity() {
    private val _mutex = Any()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val span = Measure.startSpan("activity.onCreate")
        setContentView(R.layout.activity_exception_demo)
        findViewById<Button>(R.id.btn_single_exception).setOnClickListener {
            val attributes = AttributesBuilder().put(
                "string",
                "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in"
            ).put("integer", Int.MAX_VALUE).put("long", Long.MAX_VALUE)
                .put("double", Double.MAX_VALUE).put("float", Float.MAX_VALUE).put("boolean", false)
                .build()
            Measure.trackEvent(name = "button-click", attributes = attributes)
        }
        findViewById<Button>(R.id.btn_chained_exception).setOnClickListener {
            throw IOException("This is a test exception").initCause(
                CustomException(message = "This is a nested custom exception")
            )
        }
        findViewById<Button>(R.id.btn_oom_exception).setOnClickListener {
            val list = mutableListOf<ByteArray>()
            while (true) {
                val byteArray = ByteArray(1024 * 1024 * 100) // Allocate 100MB of memory
                list.add(byteArray)
            }
        }
        findViewById<Button>(R.id.btn_stack_overflow_exception).setOnClickListener {
            recursiveFunction()
        }
        findViewById<Button>(R.id.btn_infinite_loop).setOnClickListener {
            infiniteLoop()
        }
        findViewById<Button>(R.id.btn_deadlock).setOnClickListener {
            deadLock()
        }
        findViewById<Button>(R.id.btn_okhttp).setOnClickListener {
            startActivity(Intent(this, OkHttpActivity::class.java))
        }
        findViewById<Button>(R.id.btn_compose).setOnClickListener {
            startActivity(Intent(this, ComposeActivity::class.java))
        }
        findViewById<Button>(R.id.btn_compose_navigation).setOnClickListener {
            startActivity(Intent(this, ComposeNavigationActivity::class.java))
        }
        findViewById<Button>(R.id.btn_view_screenshot).setOnClickListener {
            startActivity(Intent(this, ViewScreenshotActivity::class.java))
        }
        findViewById<Button>(R.id.btn_compose_screenshot).setOnClickListener {
            startActivity(Intent(this, ComposeScreenshotActivity::class.java))
        }
        findViewById<Button>(R.id.btn_nested_fragments).setOnClickListener {
            startActivity(Intent(this, NestedFragmentActivity::class.java))
        }
        findViewById<Button>(R.id.btn_fragment_navigation).setOnClickListener {
            startActivity(Intent(this, FragmentNavigationActivity::class.java))
        }
        findViewById<Button>(R.id.btn_fragment_androidx_navigation).setOnClickListener {
            startActivity(Intent(this, AndroidXFragmentNavigationActivity::class.java))
        }
        val spanButton = findViewById<Button>(R.id.btn_generate_span)
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
        val switch = findViewById<SwitchMaterial>(R.id.btn_sdk_switch)
        switch.isChecked = true
        switch.setOnCheckedChangeListener { _, isChecked ->
            when (isChecked) {
                true -> {
                    Measure.start()
                }

                false -> {
                    Measure.stop()
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
        Handler(Looper.getMainLooper()).postDelayed(Runnable {
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
}

class CustomException(override val message: String? = null) : Exception()