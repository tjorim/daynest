@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.app

import androidx.compose.runtime.Composable
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.daynest.android.app.navigation.DaynestDestination
import com.daynest.android.app.session.SessionGateRoute
import com.daynest.android.app.session.SessionGateViewModel
import com.daynest.android.core.storage.SecureTokenStorage
import com.daynest.android.data.auth.AuthApi
import com.daynest.android.data.auth.AuthRepository
import com.daynest.android.data.auth.AuthSessionDto
import com.daynest.android.data.auth.SignInRequestDto
import com.daynest.android.data.today.TodayApi
import com.daynest.android.data.today.TodayRepository
import com.daynest.android.data.today.TodayResponseDto
import com.daynest.android.feature.auth.AuthRoute
import com.daynest.android.feature.auth.AuthUiEvent
import com.daynest.android.feature.auth.AuthViewModel
import com.daynest.android.feature.home.HomeRoute
import com.daynest.android.feature.home.HomeViewModel
import com.daynest.android.ui.theme.DaynestTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class DaynestNavigationTest {
    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun gateGoHome_navigatesToHomeDestination() {
        val fakeStorage = FakeNavTokenStorage("valid-token")
        val fakeApi = FakeNavAuthApi(restoreResult = Result.success(AuthSessionDto("token")))
        val authRepo = AuthRepository(authApi = fakeApi, secureTokenStorage = fakeStorage)
        val sessionVm = SessionGateViewModel(authRepo)
        val authVm = AuthViewModel(authRepo)
        val homeVm = makeHomeViewModel()

        lateinit var navController: NavHostController

        composeTestRule.setContent {
            DaynestTheme {
                navController = rememberNavController()
                TestNavHost(
                    navController = navController,
                    sessionGateViewModel = sessionVm,
                    authViewModel = authVm,
                    homeViewModel = homeVm,
                )
            }
        }

        composeTestRule.waitUntil(timeoutMillis = 3_000L) {
            navController.currentDestination?.route == DaynestDestination.HOME
        }

        assertEquals(DaynestDestination.HOME, navController.currentDestination?.route)
    }

    @Test
    fun gateGoAuth_navigatesToAuthDestination() {
        val fakeStorage = FakeNavTokenStorage(null)
        val fakeApi = FakeNavAuthApi()
        val authRepo = AuthRepository(authApi = fakeApi, secureTokenStorage = fakeStorage)
        val sessionVm = SessionGateViewModel(authRepo)
        val authVm = AuthViewModel(authRepo)
        val homeVm = makeHomeViewModel()

        lateinit var navController: NavHostController

        composeTestRule.setContent {
            DaynestTheme {
                navController = rememberNavController()
                TestNavHost(
                    navController = navController,
                    sessionGateViewModel = sessionVm,
                    authViewModel = authVm,
                    homeViewModel = homeVm,
                )
            }
        }

        composeTestRule.waitUntil(timeoutMillis = 3_000L) {
            navController.currentDestination?.route == DaynestDestination.AUTH
        }

        assertEquals(DaynestDestination.AUTH, navController.currentDestination?.route)
    }

    @Test
    fun authSignedIn_navigatesToHomeDestination() {
        val fakeStorage = FakeNavTokenStorage(null)
        val fakeApi = FakeNavAuthApi(signInResult = Result.success(AuthSessionDto("new-token")))
        val authRepo = AuthRepository(authApi = fakeApi, secureTokenStorage = fakeStorage)
        val sessionVm = SessionGateViewModel(authRepo)
        val authVm = AuthViewModel(authRepo)
        val homeVm = makeHomeViewModel()

        lateinit var navController: NavHostController

        composeTestRule.setContent {
            DaynestTheme {
                navController = rememberNavController()
                TestNavHost(
                    navController = navController,
                    sessionGateViewModel = sessionVm,
                    authViewModel = authVm,
                    homeViewModel = homeVm,
                )
            }
        }

        composeTestRule.waitUntil(timeoutMillis = 3_000L) {
            navController.currentDestination?.route == DaynestDestination.AUTH
        }

        authVm.onEvent(AuthUiEvent.EmailChanged("user@example.com"))
        authVm.onEvent(AuthUiEvent.PasswordChanged("password123"))
        authVm.onEvent(AuthUiEvent.SignInClicked)

        composeTestRule.waitUntil(timeoutMillis = 3_000L) {
            navController.currentDestination?.route == DaynestDestination.HOME
        }

        assertEquals(DaynestDestination.HOME, navController.currentDestination?.route)
    }
}

@Composable
private fun TestNavHost(
    navController: NavHostController,
    sessionGateViewModel: SessionGateViewModel,
    authViewModel: AuthViewModel,
    homeViewModel: HomeViewModel,
) {
    NavHost(
        navController = navController,
        startDestination = DaynestDestination.SESSION_GATE,
    ) {
        composable(route = DaynestDestination.SESSION_GATE) {
            SessionGateRoute(
                onGoAuth = {
                    navController.navigate(DaynestDestination.AUTH) {
                        popUpTo(DaynestDestination.SESSION_GATE) { inclusive = true }
                    }
                },
                onGoHome = {
                    navController.navigate(DaynestDestination.HOME) {
                        popUpTo(DaynestDestination.SESSION_GATE) { inclusive = true }
                    }
                },
                viewModel = sessionGateViewModel,
            )
        }
        composable(route = DaynestDestination.AUTH) {
            AuthRoute(
                onSignedIn = {
                    navController.navigate(DaynestDestination.HOME) {
                        popUpTo(navController.graph.findStartDestination().id) { inclusive = true }
                        launchSingleTop = true
                    }
                },
                viewModel = authViewModel,
            )
        }
        composable(route = DaynestDestination.HOME) {
            HomeRoute(viewModel = homeViewModel)
        }
    }
}

private fun makeHomeViewModel(): HomeViewModel =
    HomeViewModel(
        repository =
            TodayRepository(
                todayApi =
                    object : TodayApi {
                        override suspend fun getToday(): TodayResponseDto = TodayResponseDto()
                    },
            ),
    )

private class FakeNavAuthApi(
    private val signInResult: Result<AuthSessionDto> = Result.failure(UnsupportedOperationException("signIn not expected")),
    private val restoreResult: Result<AuthSessionDto> = Result.failure(UnsupportedOperationException("restoreSession not expected")),
) : AuthApi {
    override suspend fun signIn(request: SignInRequestDto): AuthSessionDto = signInResult.getOrThrow()

    override suspend fun restoreSession(): AuthSessionDto = restoreResult.getOrThrow()
}

private class FakeNavTokenStorage(
    initialToken: String?,
) : SecureTokenStorage {
    private var storedToken: String? = initialToken

    override val cachedToken: String?
        get() = storedToken

    override suspend fun getToken(): String? = storedToken

    override suspend fun saveToken(token: String) {
        storedToken = token
    }

    override suspend fun clearToken() {
        storedToken = null
    }
}
