package com.daynest.android.feature.auth

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
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class AuthViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val fakeApi = FakeAuthApi()
    private val fakeStorage = FakeSecureTokenStorage()
    private val authRepository = AuthRepository(authApi = fakeApi, secureTokenStorage = fakeStorage)

    @Before
    fun setup() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `empty credentials trigger MissingCredentials error`() =
        runTest {
            val viewModel = AuthViewModel(authRepository)

            viewModel.onEvent(AuthUiEvent.SignInClicked)

            assertEquals(AuthError.MissingCredentials, viewModel.uiState.value.error)
        }

    @Test
    fun `blank password triggers MissingCredentials error`() =
        runTest {
            val viewModel = AuthViewModel(authRepository)
            viewModel.onEvent(AuthUiEvent.EmailChanged("test@example.com"))

            viewModel.onEvent(AuthUiEvent.SignInClicked)

            assertEquals(AuthError.MissingCredentials, viewModel.uiState.value.error)
        }

    @Test
    fun `successful sign-in sets isSignedIn true and clears error`() =
        runTest {
            fakeApi.enqueueSignInSuccess()
            val viewModel = AuthViewModel(authRepository)

            viewModel.onEvent(AuthUiEvent.EmailChanged("test@example.com"))
            viewModel.onEvent(AuthUiEvent.PasswordChanged("password123"))
            viewModel.onEvent(AuthUiEvent.SignInClicked)

            advanceUntilIdle()

            val state = viewModel.uiState.value
            assertTrue(state.isSignedIn)
            assertNull(state.error)
            assertFalse(state.isSubmitting)
        }

    @Test
    fun `sign-in failure emits SignInFailed error and clears isSubmitting`() =
        runTest {
            fakeApi.enqueueSignInError(RuntimeException("network error"))
            val viewModel = AuthViewModel(authRepository)

            viewModel.onEvent(AuthUiEvent.EmailChanged("test@example.com"))
            viewModel.onEvent(AuthUiEvent.PasswordChanged("password123"))
            viewModel.onEvent(AuthUiEvent.SignInClicked)

            advanceUntilIdle()

            val state = viewModel.uiState.value
            assertEquals(AuthError.SignInFailed, state.error)
            assertFalse(state.isSubmitting)
            assertFalse(state.isSignedIn)
        }

    @Test
    fun `editing email after error clears the error`() =
        runTest {
            val viewModel = AuthViewModel(authRepository)

            viewModel.onEvent(AuthUiEvent.SignInClicked)
            assertEquals(AuthError.MissingCredentials, viewModel.uiState.value.error)

            viewModel.onEvent(AuthUiEvent.EmailChanged("new@example.com"))

            assertNull(viewModel.uiState.value.error)
        }

    @Test
    fun `email is trimmed before being passed to repository`() =
        runTest {
            fakeApi.enqueueSignInSuccess()
            val viewModel = AuthViewModel(authRepository)

            viewModel.onEvent(AuthUiEvent.EmailChanged("  test@example.com  "))
            viewModel.onEvent(AuthUiEvent.PasswordChanged("password123"))
            viewModel.onEvent(AuthUiEvent.SignInClicked)

            advanceUntilIdle()

            assertEquals("test@example.com", fakeApi.lastSignInRequest?.email)
        }
}
