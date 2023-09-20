package sh.measure.sample

import android.os.Bundle
import android.widget.Button
import androidx.appcompat.app.AppCompatActivity
import java.io.IOException

class ExceptionDemoActivity : AppCompatActivity() {
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
    }
}

class CustomException(override val message: String? = null) : Exception()