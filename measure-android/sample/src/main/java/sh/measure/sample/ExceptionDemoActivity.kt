package sh.measure.sample

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.widget.Button
import androidx.appcompat.app.AppCompatActivity
import java.io.IOException


class ExceptionDemoActivity : AppCompatActivity() {
    private val _mutex = Any()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_exception_demo)

        findViewById<Button>(R.id.btn_single_exception).setOnClickListener {
            throw IllegalAccessException("This is a new exception")
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