package com.daynest.android.core.network

import com.daynest.android.data.auth.AuthRepository
import com.daynest.android.fakes.FakeAuthApi
import com.daynest.android.fakes.FakeSecureTokenStorage
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.OkHttpClient
import okhttp3.Request
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

class TokenAuthenticatorTest {
    private val server = MockWebServer()

    @Before
    fun setUp() {
        server.start()
    }

    @After
    fun tearDown() {
        server.close()
    }

    private fun buildScenario(
        initialAccessToken: String = "old-access-token",
        initialRefreshToken: String? = "old-refresh-token",
        setupApi: FakeAuthApi.() -> Unit = {},
    ): Triple<OkHttpClient, FakeSecureTokenStorage, FakeAuthApi> {
        val fakeStorage =
            FakeSecureTokenStorage(
                initialToken = initialAccessToken,
                initialRefreshToken = initialRefreshToken,
            )
        val fakeApi = FakeAuthApi().apply(setupApi)
        val authRepository = AuthRepository(authApi = fakeApi, secureTokenStorage = fakeStorage)
        val authInterceptor = AuthInterceptor(fakeStorage)
        val tokenAuthenticator = TokenAuthenticator(fakeStorage) { authRepository }
        val client =
            OkHttpClient
                .Builder()
                .addInterceptor(authInterceptor)
                .authenticator(tokenAuthenticator)
                .build()
        return Triple(client, fakeStorage, fakeApi)
    }

    @Test
    fun `401 followed by 200 retries once with updated Authorization header and persists new token`() {
        server.enqueue(MockResponse(code = 401))
        server.enqueue(MockResponse(code = 200))

        val (client, fakeStorage) =
            buildScenario(
                setupApi = {
                    enqueueRefreshSuccess(
                        accessToken = "new-access-token",
                        refreshToken = "new-refresh-token",
                    )
                },
            )

        val response =
            client
                .newCall(Request.Builder().url(server.url("/api/test")).build())
                .execute()

        assertEquals(200, response.code)
        val firstRequest = server.takeRequest()
        val retryRequest = server.takeRequest()
        assertEquals("Bearer old-access-token", firstRequest.headers["Authorization"])
        assertEquals("Bearer new-access-token", retryRequest.headers["Authorization"])
        assertEquals("new-access-token", fakeStorage.cachedToken)
    }

    @Test
    fun `401 twice does not loop infinitely and calls signOut`() {
        server.enqueue(MockResponse(code = 401))
        server.enqueue(MockResponse(code = 401))

        val (client, fakeStorage) =
            buildScenario(
                setupApi = {
                    enqueueRefreshSuccess(
                        accessToken = "new-access-token",
                        refreshToken = "new-refresh-token",
                    )
                },
            )

        val response =
            client
                .newCall(Request.Builder().url(server.url("/api/test")).build())
                .execute()

        assertEquals(401, response.code)
        assertEquals(2, server.requestCount)
        assertNull(fakeStorage.cachedToken)
    }
}
