package sh.measure.android

import android.os.Bundle
import android.widget.Button
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.unit.dp
import androidx.test.espresso.idling.CountingIdlingResource
import okhttp3.Call
import okhttp3.Callback
import okhttp3.Headers
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import sh.measure.android.okhttp.MeasureEventListenerFactory
import sh.measure.android.test.R
import java.io.IOException

class TestActivity : ComponentActivity() {
    companion object {
        const val IDLING_RES_HTTP_REQUEST = "http_request"
    }

    val httpIdlingResource = CountingIdlingResource(IDLING_RES_HTTP_REQUEST)

    @OptIn(ExperimentalComposeUiApi::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_test)
        findViewById<Button>(R.id.button).setOnClickListener {
            Toast.makeText(this, "Button clicked", Toast.LENGTH_LONG).show()
        }
        findViewById<Button>(R.id.button).setOnLongClickListener {
            Toast.makeText(this, "Button long clicked", Toast.LENGTH_LONG).show()
            return@setOnLongClickListener true
        }
        findViewById<ComposeView>(R.id.compose_view).setContent {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .semantics {
                        testTagsAsResourceId = true
                    },
            ) {
                MainContent()
            }
        }
    }

    @Composable
    fun MainContent() {
        Column(modifier = Modifier.fillMaxSize()) {
            ComposeButton()
            ComposeScroll(Modifier.weight(1f))
        }
    }

    @Composable
    fun ComposeScroll(modifier: Modifier = Modifier) {
        val items = List(30) { index -> "Item ${index + 1}" }
        LazyColumn(
            modifier = modifier.testTag("compose_scroll"),
        ) {
            items(items) { item ->
                Text(
                    text = item,
                    modifier = Modifier.padding(16.dp),
                )
            }
        }
    }

    @Composable
    fun ComposeButton() {
        Button(
            onClick = {
                Toast.makeText(
                    this@TestActivity,
                    "Compose Button clicked",
                    Toast.LENGTH_LONG,
                ).show()
            },
            modifier = Modifier
                .padding(16.dp)
                .testTag("compose_button"),
        ) {
            Text("Compose Button")
        }
    }

    fun makeRequest(url: String, headers: Headers, requestBody: String? = null) {
        httpIdlingResource.increment()
        val client =
            OkHttpClient().newBuilder().eventListenerFactory(MeasureEventListenerFactory(null))
                .build()
        val request = Request.Builder().url(url).headers(headers).apply {
            requestBody?.let { post(it.toRequestBody()) }
        }.build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                httpIdlingResource.decrement()
            }

            override fun onResponse(call: Call, response: Response) {
                httpIdlingResource.decrement()
            }
        })
    }
}
