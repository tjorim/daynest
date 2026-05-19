package com.daynest.android

import android.app.Application
import androidx.lifecycle.ProcessLifecycleOwner
import androidx.lifecycle.lifecycleScope
import com.daynest.android.core.network.ServerUrlHolder
import com.daynest.android.core.storage.preferences.UserPreferencesRepository
import dagger.hilt.android.HiltAndroidApp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltAndroidApp
class DaynestApplication : Application() {
    @Inject
    lateinit var userPreferencesRepository: UserPreferencesRepository

    @Inject
    lateinit var serverUrlHolder: ServerUrlHolder

    override fun onCreate() {
        super.onCreate()
        ProcessLifecycleOwner.get().lifecycleScope.launch(Dispatchers.IO) {
            userPreferencesRepository.preferences
                .map { it.customServerUrl }
                .collect { url -> serverUrlHolder.updateUrl(url) }
        }
    }
}
