package com.daynest.android.core.network

import com.daynest.android.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

class DynamicBaseUrlInterceptorTest {
    private val mockWebServer = MockWebServer()
    private val serverUrlHolder = ServerUrlHolder()
    private val interceptor = DynamicBaseUrlInterceptor(serverUrlHolder)
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
    fun `requests are routed to the URL stored in ServerUrlHolder`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(200))
        val serverUrl = mockWebServer.url("/").toString()
        serverUrlHolder.updateUrl(serverUrl)

        val request = Request.Builder().url("https://original.example.com/api/v1/today").build()
        val response = client.newCall(request).execute()

        assertEquals(200, response.code)
        val recorded = mockWebServer.takeRequest()
        assertEquals("/api/v1/today", recorded.path)
    }

    @Test
    fun `ServerUrlHolder defaults to BuildConfig API_BASE_URL`() {
        val holder = ServerUrlHolder()
        val expected = BuildConfig.API_BASE_URL.trimEnd('/') + "/"
        assertEquals(expected, holder.currentUrl)
    }

    @Test
    fun `updateUrl with null resets to BuildConfig default`() {
        val holder = ServerUrlHolder()
        holder.updateUrl("https://custom.example.com/")
        assertEquals("https://custom.example.com/", holder.currentUrl)

        holder.updateUrl(null)
        val expected = BuildConfig.API_BASE_URL.trimEnd('/') + "/"
        assertEquals(expected, holder.currentUrl)
    }

    @Test
    fun `base URL path prefix is prepended to request path`() {
        mockWebServer.enqueue(MockResponse().setResponseCode(200))
        serverUrlHolder.updateUrl(mockWebServer.url("/api/").toString())

        val request = Request.Builder().url("https://original.example.com/v1/today").build()
        client.newCall(request).execute()

        assertEquals("/api/v1/today", mockWebServer.takeRequest().path)
    }

    @Test
    fun `updateUrl appends trailing slash when missing`() {
        val holder = ServerUrlHolder()
        holder.updateUrl("https://selfhosted.example.com")
        assertEquals("https://selfhosted.example.com/", holder.currentUrl)
    }
}
