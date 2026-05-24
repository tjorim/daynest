package com.daynest.android.core.notifications

import android.util.Log
import com.daynest.android.data.push.PushRegistrationManager
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class DaynestFirebaseMessagingService : FirebaseMessagingService() {
    @Inject
    lateinit var notificationHandler: PushNotificationHandler

    @Inject
    lateinit var pushRegistrationManager: PushRegistrationManager

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onMessageReceived(message: RemoteMessage) {
        notificationHandler.handlePayload(PushPayload.fromData(message.data))
    }

    override fun onNewToken(token: String) {
        scope.launch {
            runCatching { pushRegistrationManager.registerFcmToken(token) }
                .onFailure { error -> Log.w(TAG, "Unable to register refreshed FCM token", error) }
        }
    }

    companion object {
        private const val TAG = "DaynestFcmService"
    }
}
