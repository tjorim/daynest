package com.daynest.android.core.auth

import android.net.Uri
import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkStatic
import io.mockk.unmockkStatic
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.IOException

class OidcServiceConfigurationDiscoveryTest {
    private val server = MockWebServer()

    @Before
    fun setUp() {
        server.start()
        mockkStatic(Uri::class)
        every { Uri.parse(any()) } answers {
            fakeUri(firstArg())
        }
    }

    private fun fakeUri(value: String): Uri {
        val uri = mockk<Uri>()
        every { uri.toString() } returns value
        return uri
    }

    @After
    fun tearDown() {
        unmockkStatic(Uri::class)
        server.shutdown()
    }

    @Test
    fun `fetch calls API config endpoint and uses returned auth and token urls`() {
        server.enqueue(
            MockResponse().setBody(
                """
                {
                  "issuer": "https://auth.example.test/realms/daynest",
                  "authorization_url": "https://auth.example.test/realms/daynest/protocol/openid-connect/auth",
                  "token_url": "https://auth.example.test/realms/daynest/protocol/openid-connect/token"
                }
                """.trimIndent(),
            ),
        )

        val config =
            OidcServiceConfigurationDiscovery(OkHttpClient())
                .fetch(server.url("/").toString())

        assertEquals("/api/v1/auth/oidc-config", server.takeRequest().path)
        assertEquals(
            "https://auth.example.test/realms/daynest/protocol/openid-connect/auth",
            config.authorizationEndpoint.toString(),
        )
        assertEquals(
            "https://auth.example.test/realms/daynest/protocol/openid-connect/token",
            config.tokenEndpoint.toString(),
        )
    }

    @Test
    fun `fetch throws with bounded error snippet on non-2xx response`() {
        server.enqueue(MockResponse().setResponseCode(502).setBody("x".repeat(5000)))

        val exception =
            assertThrows(IOException::class.java) {
                OidcServiceConfigurationDiscovery(OkHttpClient())
                    .fetch(server.url("/").toString())
            }

        assertTrue(exception.message!!.contains("HTTP 502"))
        assertTrue(exception.message!!.length < 1200)
    }
}
