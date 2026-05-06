package com.daynest.android.data.auth

import com.daynest.android.fakes.FakeAuthApi
import com.daynest.android.fakes.FakeSecureTokenStorage
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AuthRepositoryTest {
    private val fakeApi = FakeAuthApi()
    private val fakeStorage =
        FakeSecureTokenStorage(
            initialToken = "old-access-token",
            initialRefreshToken = "old-refresh-token",
        )
    private val repository = AuthRepository(authApi = fakeApi, secureTokenStorage = fakeStorage)

    @Test
    fun `refreshAccessToken returns new token and persists both tokens on success`() =
        runTest {
            fakeApi.enqueueRefreshSuccess(
                accessToken = "new-access-token",
                refreshToken = "new-refresh-token",
            )

            val result = repository.refreshAccessToken()

            assertEquals("new-access-token", result)
            assertEquals("new-access-token", fakeStorage.cachedToken)
            assertEquals("new-refresh-token", fakeStorage.cachedRefreshToken)
        }

    @Test
    fun `refreshAccessToken returns null and calls signOut on API failure`() =
        runTest {
            fakeApi.enqueueRefreshError(RuntimeException("network error"))

            val result = repository.refreshAccessToken()

            assertNull(result)
            assertNull(fakeStorage.cachedToken)
            assertNull(fakeStorage.cachedRefreshToken)
        }

    @Test
    fun `refreshAccessToken returns null when no refresh token is stored`() =
        runTest {
            val storageWithoutRefresh = FakeSecureTokenStorage(initialToken = "access-token")
            val repo = AuthRepository(authApi = fakeApi, secureTokenStorage = storageWithoutRefresh)

            val result = repo.refreshAccessToken()

            assertNull(result)
        }

    @Test
    fun `signOut clears both access and refresh tokens`() =
        runTest {
            repository.signOut()

            assertNull(fakeStorage.cachedToken)
            assertNull(fakeStorage.cachedRefreshToken)
        }

    @Test
    fun `signIn saves refresh token when returned by API`() =
        runTest {
            val storage = FakeSecureTokenStorage()
            val api =
                FakeAuthApi().apply {
                    enqueueSignInSuccess(accessToken = "access-token", refreshToken = "refresh-token")
                }
            val repo = AuthRepository(authApi = api, secureTokenStorage = storage)

            repo.signIn("user@example.com", "password")

            assertEquals("access-token", storage.cachedToken)
            assertEquals("refresh-token", storage.cachedRefreshToken)
        }
}
