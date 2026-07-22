package com.daynest.android.core.network

import com.daynest.android.core.storage.ApiBaseUrlOverrideStore
import io.mockk.every
import io.mockk.mockk
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class DynamicBaseUrlInterceptorTest {
    private val mockWebServer = MockWebServer()
    private val apiBaseUrlOverrideStore = mockk<ApiBaseUrlOverrideStore>()
    private val interceptor = DynamicBaseUrlInterceptor(apiBaseUrlOverrideStore)
    private val client = OkHttpClient.Builder().addInterceptor(interceptor).build()

    @Before
    fun setUp() {
        mockWebServer.start()
    }

    @After
    fun tearDown() {
        mockWebServer.shutdown()
    }

    @Test
    fun `requests are routed to the URL stored in ApiBaseUrlOverrideStore`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(200))
        val serverUrl = mockWebServer.url("/").toString()
        every { apiBaseUrlOverrideStore.currentOverrideBlocking() } returns serverUrl

        val request = Request.Builder().url("https://original.example.com/api/today").build()
        client.newCall(request).execute().use { response ->
            assertEquals(200, response.code)
        }
        val recorded = mockWebServer.takeRequest()
        assertEquals("/api/today", recorded.path)
    }

    @Test
    fun `base URL path prefix is prepended to request path`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(200))
        every { apiBaseUrlOverrideStore.currentOverrideBlocking() } returns mockWebServer.url("/api/").toString()

        val request = Request.Builder().url("https://original.example.com/v1/today").build()
        client.newCall(request).execute().close()

        assertEquals("/api/v1/today", mockWebServer.takeRequest().path)
    }

    @Test
    fun `overlapping base path segment is not duplicated`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(200))
        every { apiBaseUrlOverrideStore.currentOverrideBlocking() } returns mockWebServer.url("/api/").toString()

        val request = Request.Builder().url("https://original.example.com/api/today").build()
        client.newCall(request).execute().close()

        assertEquals("/api/today", mockWebServer.takeRequest().path)
    }

    @Test
    fun `valid http url is accepted`() {
        assertTrue(DynamicBaseUrlInterceptor.isValidOverride("http://10.0.2.2:8000/"))
    }

    @Test
    fun `valid https url is accepted`() {
        assertTrue(DynamicBaseUrlInterceptor.isValidOverride("https://api.example.com/"))
    }

    @Test
    fun `blank url is rejected`() {
        assertFalse(DynamicBaseUrlInterceptor.isValidOverride(""))
    }

    @Test
    fun `malformed url is rejected`() {
        assertFalse(DynamicBaseUrlInterceptor.isValidOverride("not-a-url"))
    }

    @Test
    fun `url without scheme is rejected`() {
        assertFalse(DynamicBaseUrlInterceptor.isValidOverride("example.com"))
    }
}
