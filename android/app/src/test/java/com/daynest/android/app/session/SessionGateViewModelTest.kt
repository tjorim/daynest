package com.daynest.android.app.session

import com.daynest.android.data.auth.AuthRepository
import com.daynest.android.fakes.FakeAuthApi
import com.daynest.android.fakes.FakeSecureTokenStorage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response

@OptIn(ExperimentalCoroutinesApi::class)
class SessionGateViewModelTest {
    private val dispatcher = StandardTestDispatcher()

    @Before
    fun setup() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `initial state is Loading`() =
        runTest {
            val viewModel = buildViewModel()

            assertEquals(SessionGateUiState.Loading, viewModel.uiState.value)
        }

    @Test
    fun `valid session emits GoHome`() =
        runTest {
            val viewModel =
                buildViewModel(
                    initialToken = "valid-token",
                    setupApi = { enqueueRestoreSuccess() },
                )

            advanceUntilIdle()

            assertEquals(SessionGateUiState.GoHome, viewModel.uiState.value)
        }

    @Test
    fun `no stored token emits GoAuth`() =
        runTest {
            val viewModel = buildViewModel(initialToken = null)

            advanceUntilIdle()

            assertEquals(SessionGateUiState.GoAuth, viewModel.uiState.value)
        }

    @Test
    fun `401 during restoreSession clears token and emits GoAuth`() =
        runTest {
            val fakeStorage = FakeSecureTokenStorage(initialToken = "expired-token")
            val fakeApi =
                FakeAuthApi().apply {
                    enqueueRestoreError(
                        HttpException(Response.error<Any>(HTTP_UNAUTHORIZED, "".toResponseBody())),
                    )
                }
            val authRepo = AuthRepository(authApi = fakeApi, secureTokenStorage = fakeStorage)
            val viewModel = SessionGateViewModel(authRepo)

            advanceUntilIdle()

            assertEquals(SessionGateUiState.GoAuth, viewModel.uiState.value)
            assertNull(fakeStorage.cachedToken)
        }

    private fun buildViewModel(
        initialToken: String? = null,
        setupApi: FakeAuthApi.() -> Unit = {},
    ): SessionGateViewModel {
        val fakeStorage = FakeSecureTokenStorage(initialToken = initialToken)
        val fakeApi = FakeAuthApi().apply(setupApi)
        val authRepo = AuthRepository(authApi = fakeApi, secureTokenStorage = fakeStorage)
        return SessionGateViewModel(authRepo)
    }

    private companion object {
        const val HTTP_UNAUTHORIZED = 401
    }
}
