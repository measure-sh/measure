package sh.measure.android.screenshot

import android.text.InputType
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView
import androidx.compose.foundation.clickable
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric.buildActivity
import sh.measure.android.fakes.FakeConfig


@ExperimentalMaterial3Api
@RunWith(AndroidJUnit4::class)
class ScreenshotMaskTest {
    private val config = FakeConfig()
    private val controller = buildActivity(ScreenshotTestActivity::class.java)

    @Test
    fun `masks text given mask level is AllTextAndMedia`() {
        val activity = controller.get()
        val decorView = activity.window.decorView.rootView
        val textView = TextView(activity).apply {
            text = "Hello, World!"
        }
        initActivityWithView(textView)

        config.screenshotMaskLevel = ScreenshotMaskLevel.AllTextAndMedia
        val result = ScreenshotMask(config).findRectsToMask(decorView)
        assertEquals(1, result.size)
    }

    @Test
    fun `masks text given mask level is AllText`() {
        val activity = controller.get()
        val decorView = activity.window.decorView.rootView
        val textView = TextView(activity).apply {
            text = "Hello, World!"
        }
        initActivityWithView(textView)

        config.screenshotMaskLevel = ScreenshotMaskLevel.AllText
        val result = ScreenshotMask(config).findRectsToMask(decorView)
        assertEquals(1, result.size)
    }

    @Test
    fun `does not mask clickable text given mask level is AllTextExceptClickable`() {
        val activity = controller.get()
        val decorView = activity.window.decorView.rootView
        val textView = TextView(activity).apply {
            text = "Hello, World!"
            isClickable = true
        }
        initActivityWithView(textView)

        config.screenshotMaskLevel = ScreenshotMaskLevel.AllTextExceptClickable
        val result = ScreenshotMask(config).findRectsToMask(decorView)
        assertEquals(0, result.size)
    }

    @Test
    fun `mask clickable text given mask level is AllText`() {
        val activity = controller.get()
        val decorView = activity.window.decorView.rootView
        val textView = TextView(activity).apply {
            text = "Hello, World!"
            isClickable = true
        }
        initActivityWithView(textView)

        config.screenshotMaskLevel = ScreenshotMaskLevel.AllText
        val result = ScreenshotMask(config).findRectsToMask(decorView)
        assertEquals(1, result.size)
    }

    @Test
    fun `mask clickable text given mask level is AllTextAndMedia`() {
        val activity = controller.get()
        val decorView = activity.window.decorView.rootView
        val textView = TextView(activity).apply {
            text = "Hello, World!"
            isClickable = true
        }
        initActivityWithView(textView)

        config.screenshotMaskLevel = ScreenshotMaskLevel.AllTextAndMedia
        val result = ScreenshotMask(config).findRectsToMask(decorView)
        assertEquals(1, result.size)
    }

    @Test
    fun `does not mask text without input type, given mask level is SensitiveFieldsOnly`() {
        val activity = controller.get()
        val decorView = activity.window.decorView.rootView
        val textView = TextView(activity).apply {
            text = "Hello, World!"
        }
        initActivityWithView(textView)

        config.screenshotMaskLevel = ScreenshotMaskLevel.SensitiveFieldsOnly
        val result = ScreenshotMask(config).findRectsToMask(decorView)
        assertEquals(0, result.size)
    }

    @Test
    fun `masks text with input type password, given mask level is SensitiveFieldsOnly`() {
        val activity = controller.get()
        val decorView = activity.window.decorView.rootView
        val textView = TextView(activity).apply {
            text = "Hello, World!"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        initActivityWithView(textView)

        config.screenshotMaskLevel = ScreenshotMaskLevel.SensitiveFieldsOnly
        val result = ScreenshotMask(config).findRectsToMask(decorView)
        assertEquals(1, result.size)
    }

    @Test
    fun `masks text with input type email, given mask level is SensitiveFieldsOnly`() {
        val activity = controller.get()
        val decorView = activity.window.decorView.rootView
        val textView = TextView(activity).apply {
            text = "Hello, World!"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
        }
        initActivityWithView(textView)

        config.screenshotMaskLevel = ScreenshotMaskLevel.SensitiveFieldsOnly
        val result = ScreenshotMask(config).findRectsToMask(decorView)
        assertEquals(1, result.size)
    }

    @Test
    fun `masks text with input type phone, given mask level is SensitiveFieldsOnly`() {
        val activity = controller.get()
        val decorView = activity.window.decorView.rootView
        val textView = TextView(activity).apply {
            text = "Hello, World!"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_CLASS_PHONE
        }
        initActivityWithView(textView)

        config.screenshotMaskLevel = ScreenshotMaskLevel.SensitiveFieldsOnly
        val result = ScreenshotMask(config).findRectsToMask(decorView)
        assertEquals(1, result.size)
    }

    @Test
    fun `masks image given mask level is AllTextAndMedia`() {
        val activity = controller.get()
        val decorView = activity.window.decorView.rootView
        val imageView = ImageView(activity)
        initActivityWithView(imageView)

        config.screenshotMaskLevel = ScreenshotMaskLevel.AllTextAndMedia
        val result = ScreenshotMask(config).findRectsToMask(decorView)
        assertEquals(1, result.size)
    }

    @Test
    fun `does not mask image given mask level is AllText`() {
        val activity = controller.get()
        val decorView = activity.window.decorView.rootView
        val imageView = ImageView(activity)
        initActivityWithView(imageView)

        config.screenshotMaskLevel = ScreenshotMaskLevel.AllText
        val result = ScreenshotMask(config).findRectsToMask(decorView)
        assertEquals(0, result.size)
    }

    @Test
    fun `masks compose text, given mask level is AllTextAndMedia`() {
        val activity = controller.get()
        val decorView = activity.window.decorView.rootView
        val composeView = ComposeView(activity)
        composeView.setContent {
            Text(text = "Hello, World!")
        }
        initActivityWithView(composeView)

        config.screenshotMaskLevel = ScreenshotMaskLevel.AllTextAndMedia
        val result = ScreenshotMask(config).findRectsToMask(decorView)
        assertEquals(1, result.size)
    }

    @Test
    fun `masks compose text, given mask level is AllText`() {
        val activity = controller.get()
        val decorView = activity.window.decorView.rootView
        val composeView = ComposeView(activity)
        composeView.setContent {
            Text(text = "Hello, World!")
        }
        initActivityWithView(composeView)

        config.screenshotMaskLevel = ScreenshotMaskLevel.AllText
        val result = ScreenshotMask(config).findRectsToMask(decorView)
        assertEquals(1, result.size)
    }

    @Test
    fun `masks compose text, given mask level is AllTextExceptClickable`() {
        val activity = controller.get()
        val decorView = activity.window.decorView.rootView
        val composeView = ComposeView(activity)
        composeView.setContent {
            Text(text = "Hello, World!")
        }
        initActivityWithView(composeView)

        config.screenshotMaskLevel = ScreenshotMaskLevel.AllTextExceptClickable
        val result = ScreenshotMask(config).findRectsToMask(decorView)
        assertEquals(1, result.size)
    }

    @Test
    fun `does not mask clickable compose text, given mask level is AllTextExceptClickable`() {
        val activity = controller.get()
        val decorView = activity.window.decorView.rootView
        val composeView = ComposeView(activity)
        composeView.setContent {
            Text(text = "Hello, World!", Modifier.clickable { })
        }
        initActivityWithView(composeView)

        config.screenshotMaskLevel = ScreenshotMaskLevel.AllTextExceptClickable
        val result = ScreenshotMask(config).findRectsToMask(decorView)
        assertEquals(0, result.size)
    }

    @Test
    fun `masks compose text with input type password, given mask level is SensitiveFieldsOnly`() {
        val activity = controller.get()
        val decorView = activity.window.decorView.rootView
        val composeView = ComposeView(activity)
        composeView.setContent {
            TextField(
                value = "input",
                onValueChange = {},
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
            )
        }
        initActivityWithView(composeView)

        config.screenshotMaskLevel = ScreenshotMaskLevel.SensitiveFieldsOnly
        val result = ScreenshotMask(config).findRectsToMask(decorView)
        assertEquals(1, result.size)
    }

    // Identifying KeyboardType in compose is not possible with the current approach, see [ScreenshotMask].
    @Test
    fun `does not mask compose text with input type email, given mask level is SensitiveFieldsOnly`() {
        val activity = controller.get()
        val decorView = activity.window.decorView.rootView
        val composeView = ComposeView(activity)
        composeView.setContent {
            TextField(
                value = "input",
                onValueChange = {},
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
            )
        }
        initActivityWithView(composeView)

        config.screenshotMaskLevel = ScreenshotMaskLevel.SensitiveFieldsOnly
        val result = ScreenshotMask(config).findRectsToMask(decorView)
        assertEquals(1, result.size)
    }

    @Test
    fun `masks compose editable text, given mask level is AllTextAndMedia`() {
        val activity = controller.get()
        val decorView = activity.window.decorView.rootView
        val composeView = ComposeView(activity)
        composeView.setContent {
            TextField(value = "input", onValueChange = {})
        }
        initActivityWithView(composeView)

        config.screenshotMaskLevel = ScreenshotMaskLevel.AllTextAndMedia
        val result = ScreenshotMask(config).findRectsToMask(decorView)
        assertEquals(1, result.size)
    }

    @Test
    fun `masks compose editable text, given mask level is AllText`() {
        val activity = controller.get()
        val decorView = activity.window.decorView.rootView
        val composeView = ComposeView(activity)
        composeView.setContent {
            TextField(value = "input", onValueChange = {})
        }
        initActivityWithView(composeView)

        config.screenshotMaskLevel = ScreenshotMaskLevel.AllTextAndMedia
        val result = ScreenshotMask(config).findRectsToMask(decorView)
        assertEquals(1, result.size)
    }

    private fun initActivityWithView(view: View) {
        val activity = controller.get()
        val rootView = FrameLayout(activity)
        rootView.addView(view)
        activity.setContentView(rootView)
        activity.setTitle(null) // remove the title as it inserts a TextView
        controller.setup()
    }
}