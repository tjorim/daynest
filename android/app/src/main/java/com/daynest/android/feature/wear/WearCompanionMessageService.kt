package com.daynest.android.feature.wear

import com.daynest.android.data.today.TodayRepository
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class WearCompanionMessageService : WearableListenerService() {
    @Inject
    lateinit var todayRepository: TodayRepository

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onMessageReceived(messageEvent: MessageEvent) {
        val path = messageEvent.path
        val payload = messageEvent.data.toString(Charsets.UTF_8).trim()
        val id = payload.toIntOrNull() ?: return
        serviceScope.launch {
            when (path) {
                ACTION_COMPLETE_CHORE -> todayRepository.completeChore(id)
                ACTION_TAKE_MEDICATION -> todayRepository.takeDose(id)
                else -> Unit
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
    }

    private companion object {
        const val ACTION_COMPLETE_CHORE = "/daynest/actions/complete_chore"
        const val ACTION_TAKE_MEDICATION = "/daynest/actions/take_medication"
    }
}
