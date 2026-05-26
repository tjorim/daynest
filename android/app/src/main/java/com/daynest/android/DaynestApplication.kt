package com.daynest.android

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import androidx.lifecycle.lifecycleScope
import androidx.work.Configuration
import com.daynest.android.core.network.ServerUrlHolder
import com.daynest.android.core.notifications.DaynestNotificationChannels
import com.daynest.android.core.storage.preferences.UserPreferencesRepository
import com.daynest.android.data.sync.DaynestSyncScheduler
import com.daynest.android.widget.TodayWidgetRefreshWorker
import dagger.hilt.android.HiltAndroidApp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltAndroidApp
class DaynestApplication :
    Application(),
    Configuration.Provider {
    @Inject
    lateinit var userPreferencesRepository: UserPreferencesRepository

    @Inject
    lateinit var serverUrlHolder: ServerUrlHolder

    @Inject
    lateinit var workerFactory: HiltWorkerFactory

    override fun onCreate() {
        super.onCreate()
        DaynestNotificationChannels.ensureCreated(this)
        DaynestSyncScheduler.schedulePeriodic(this)
        TodayWidgetRefreshWorker.schedulePeriodic(this)
        ProcessLifecycleOwner.get().lifecycle.addObserver(
            object : DefaultLifecycleObserver {
                override fun onStart(owner: LifecycleOwner) {
                    DaynestSyncScheduler.enqueueOneShot(this@DaynestApplication)
                }

                override fun onStop(owner: LifecycleOwner) {
                    owner.lifecycleScope.launch(Dispatchers.IO) {
                        userPreferencesRepository.updateLastBackgroundEpochMillis(System.currentTimeMillis())
                    }
                }
            },
        )
        ProcessLifecycleOwner.get().lifecycleScope.launch(Dispatchers.IO) {
            userPreferencesRepository.preferences
                .map { it.customServerUrl }
                .collect { url -> serverUrlHolder.updateUrl(url) }
        }
    }

    override val workManagerConfiguration: Configuration
        get() =
            Configuration
                .Builder()
                .setWorkerFactory(workerFactory)
                .build()
}
