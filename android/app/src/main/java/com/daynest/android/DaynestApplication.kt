package com.daynest.android

import android.app.Application
import com.daynest.android.core.network.ServerUrlHolder
import com.daynest.android.core.storage.preferences.UserPreferencesRepository
import dagger.hilt.android.HiltAndroidApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltAndroidApp
class DaynestApplication : Application() {
    @Inject
    lateinit var userPreferencesRepository: UserPreferencesRepository

    @Inject
    lateinit var serverUrlHolder: ServerUrlHolder

    private val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()
        applicationScope.launch {
            userPreferencesRepository.preferences
                .map { it.customServerUrl }
                .collect { url -> serverUrlHolder.updateUrl(url) }
        }
    }

    override fun onTerminate() {
        super.onTerminate()
        applicationScope.cancel()
    }
}
