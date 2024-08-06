package sh.measure.test.benchmark

import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.FrameLayout
import android.widget.FrameLayout.LayoutParams
import android.widget.FrameLayout.LayoutParams.MATCH_PARENT
import android.widget.FrameLayout.LayoutParams.WRAP_CONTENT
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class ViewTargetFinderBenchmarkActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_view_target_finder_benchmark)

        val container = findViewById<FrameLayout>(R.id.fl_container)
        var currentParent = container

        // Create a deep view hierarchy
        for (i in 1..50) {
            val newFrame = FrameLayout(this).apply {
                // Set Layout Params and other properties as needed
                layoutParams = LayoutParams(MATCH_PARENT, MATCH_PARENT)
            }
            currentParent.addView(newFrame)
            currentParent = newFrame
        }

        val button = Button(this).apply {
            id = R.id.btn_view_click
            text = resources.getString(R.string.click)
            layoutParams = LayoutParams(WRAP_CONTENT, WRAP_CONTENT).also {
                it.gravity = Gravity.CENTER
            }
        }
        button.setOnClickListener {
            Toast.makeText(this, "Button clicked", Toast.LENGTH_SHORT).show()
        }
        currentParent.addView(button)
    }
}
