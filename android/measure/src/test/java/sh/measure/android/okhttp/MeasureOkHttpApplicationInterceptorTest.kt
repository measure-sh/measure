package sh.measure.android.okhttp

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito
import org.mockito.Mockito.mock
import org.mockito.kotlin.verify

class MeasureOkHttpApplicationInterceptorTest {
    private lateinit var mockWebServer: MockWebServer
    private lateinit var client: OkHttpClient
    private val eventCollector = mock<OkHttpEventCollector>()

    @Before
    fun setUp() {
        mockWebServer = MockWebServer().apply {
            start()
        }
        client = OkHttpClient.Builder()
            .addInterceptor(MeasureOkHttpApplicationInterceptor(eventCollector))
            .build()
    }

    @After
    fun tearDown() {
        mockWebServer.shutdown()
    }

    @Test
    fun `forwards the request and response to event processor when response is received`() {
        val mockResponse = MockResponse().apply {
            setResponseCode(200)
        }
        mockWebServer.enqueue(mockResponse)
        val request = Request.Builder().url(mockWebServer.url("/")).build()
        val call = client.newCall(request)
        val response = call.execute()

        verify(eventCollector).request(call, request)
        verify(eventCollector).response(call, request, response)
    }

    @Test
    fun `forwards the request and not the response when request fails with an exception`() {
        // Shut down the server to simulate a failed request
        mockWebServer.shutdown()
        val request = Request.Builder().url("http://localhost:9999").build()
        val call = client.newCall(request)

        try {
            call.execute()
        } catch (e: Exception) {
            // Ignore the exception
        }
        verify(eventCollector).request(call, request)
        Mockito.verifyNoMoreInteractions(eventCollector)
    }
}
