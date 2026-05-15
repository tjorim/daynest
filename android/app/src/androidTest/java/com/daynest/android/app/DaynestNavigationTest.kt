@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.app

import androidx.compose.runtime.Composable
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
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
import com.daynest.android.core.database.today.TodaySummaryDao
import com.daynest.android.core.database.today.TodaySummaryEntity
import com.daynest.android.data.auth.RefreshRequestDto
import com.daynest.android.data.today.ChoreMutationDto
import com.daynest.android.data.today.DoseMutationDto
import com.daynest.android.data.today.PlannedItemCreateDto
import com.daynest.android.data.today.PlannedItemUpdateDto
import com.daynest.android.data.today.PlannedTodayItemDto
import com.daynest.android.data.today.TaskMutationDto
import com.daynest.android.data.today.TodayActionsApi
import com.daynest.android.data.today.TodayApi
import com.daynest.android.data.today.TodayRepository
import com.daynest.android.data.today.TodayResponseDto
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import com.daynest.android.feature.auth.AuthRoute
import com.daynest.android.feature.auth.AuthUiEvent
import com.daynest.android.feature.auth.AuthViewModel
import com.daynest.android.feature.calendar.CalendarRoute
import com.daynest.android.feature.home.HomeRoute
import com.daynest.android.feature.home.HomeViewModel
import com.daynest.android.feature.medication.MedicationRoute
import com.daynest.android.feature.settings.SettingsRoute
import com.daynest.android.feature.templates.TemplatesRoute
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

    @Test
    fun homeBottomNavigation_opensCalendarDestination() {
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

        composeTestRule.onNodeWithText("Calendar").performClick()
        composeTestRule.waitUntil(timeoutMillis = 3_000L) {
            navController.currentDestination?.route == DaynestDestination.CALENDAR
        }

        assertEquals(DaynestDestination.CALENDAR, navController.currentDestination?.route)
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
            HomeRoute(viewModel = homeViewModel, onNavigate = navController::navigate)
        }
        composable(route = DaynestDestination.CALENDAR) {
            CalendarRoute(onNavigate = navController::navigate)
        }
        composable(route = DaynestDestination.MEDICATION) {
            MedicationRoute(onNavigate = navController::navigate)
        }
        composable(route = DaynestDestination.TEMPLATES) {
            TemplatesRoute(onNavigate = navController::navigate)
        }
        composable(route = DaynestDestination.SETTINGS) {
            SettingsRoute(onNavigate = navController::navigate)
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
                todayActionsApi =
                    object : TodayActionsApi {
                        override suspend fun completeChore(id: Int): ChoreMutationDto =
                            ChoreMutationDto(id, "completed")
                        override suspend fun skipChore(id: Int): ChoreMutationDto = ChoreMutationDto(id, "skipped")
                        override suspend fun completeTask(id: Int): TaskMutationDto = TaskMutationDto(id, "completed")
                        override suspend fun skipTask(id: Int): TaskMutationDto = TaskMutationDto(id, "skipped")
                        override suspend fun startTask(id: Int): TaskMutationDto = TaskMutationDto(id, "in_progress")
                        override suspend fun takeDose(id: Int): DoseMutationDto = DoseMutationDto(id, "taken")
                        override suspend fun skipDose(id: Int): DoseMutationDto = DoseMutationDto(id, "skipped")
                        override suspend fun updatePlannedItem(
                            id: Int,
                            request: PlannedItemUpdateDto,
                        ): PlannedTodayItemDto = PlannedTodayItemDto(id, request.title, request.isDone)
                        override suspend fun deletePlannedItem(id: Int) = Unit
                        override suspend fun createPlannedItem(
                            request: PlannedItemCreateDto,
                        ): PlannedTodayItemDto = PlannedTodayItemDto(0, request.title, false)
                    },
                todaySummaryDao =
                    object : TodaySummaryDao {
                        private val flow = MutableStateFlow<TodaySummaryEntity?>(null)
                        override fun observe(): Flow<TodaySummaryEntity?> = flow
                        override suspend fun upsert(entity: TodaySummaryEntity) { flow.value = entity }
                        override suspend fun clear() { flow.value = null }
                    },
            ),
    )

private class FakeNavAuthApi(
    private val signInResult: Result<AuthSessionDto> =
        Result.failure(UnsupportedOperationException("signIn not expected")),
    private val restoreResult: Result<AuthSessionDto> =
        Result.failure(UnsupportedOperationException("restoreSession not expected")),
) : AuthApi {
    override suspend fun signIn(request: SignInRequestDto): AuthSessionDto = signInResult.getOrThrow()

    override suspend fun restoreSession(): AuthSessionDto = restoreResult.getOrThrow()

    override suspend fun refresh(request: RefreshRequestDto): AuthSessionDto =
        throw UnsupportedOperationException("refresh not expected")
}

private class FakeNavTokenStorage(
    initialToken: String?,
) : SecureTokenStorage {
    private var storedToken: String? = initialToken
    private var storedRefreshToken: String? = null

    override val cachedToken: String?
        get() = storedToken

    override val cachedRefreshToken: String?
        get() = storedRefreshToken

    override suspend fun getToken(): String? = storedToken

    override suspend fun saveToken(token: String) {
        storedToken = token
    }

    override suspend fun clearToken() {
        storedToken = null
    }

    override suspend fun getRefreshToken(): String? = storedRefreshToken

    override suspend fun saveRefreshToken(token: String) {
        storedRefreshToken = token
    }

    override suspend fun clearRefreshToken() {
        storedRefreshToken = null
    }
}
