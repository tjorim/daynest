package com.daynest.android.core.auth

import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

class OidcServiceConfigurationDiscoveryTest {
    private val server = MockWebServer()

    @Before
    fun setUp() {
        server.start()
    }

    @After
    fun tearDown() {
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
}
