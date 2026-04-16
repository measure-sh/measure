package sh.frankenstein.android

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.button.MaterialButton

class ViewScreenshotActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_view_screenshot)
        findViewById<MaterialToolbar>(R.id.toolbar).setNavigationOnClickListener { finish() }

        findViewById<MaterialButton>(R.id.btn_crash).setOnClickListener {
            throw IllegalAccessException("Exception to test a screenshot")
        }
        findViewById<MaterialButton>(R.id.btn_anr).setOnClickListener {
            Thread.sleep(10_000)
        }
    }
}
