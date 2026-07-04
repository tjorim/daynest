package com.daynest.android.core.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.daynest.android.data.push.PushRegistrationManager
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

@AndroidEntryPoint
class UnifiedPushReceiver : BroadcastReceiver() {
    @Inject
    lateinit var pushRegistrationManager: PushRegistrationManager

    @Inject
    lateinit var notificationHandler: PushNotificationHandler

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            ACTION_NEW_ENDPOINT ->
                scope.launch {
                    runCatching {
                        pushRegistrationManager.registerUnifiedPushEndpoint(
                            endpoint = intent.getStringExtra(EXTRA_ENDPOINT).orEmpty(),
                            p256dh = intent.getStringExtra(EXTRA_P256DH),
                            auth = intent.getStringExtra(EXTRA_AUTH)
                        )
                    }.onFailure { error -> Log.w(TAG, "Unable to register Unified Push endpoint", error) }
                }
            ACTION_MESSAGE -> notificationHandler.handlePayload(PushPayload.fromData(intent.extras.toStringMap()))
        }
    }

    private fun android.os.Bundle?.toStringMap(): Map<String, String> {
        if (this == null) return emptyMap()
        return keySet().associateWith { key -> get(key)?.toString().orEmpty() }
    }

    companion object {
        private const val TAG = "UnifiedPushReceiver"
        private const val ACTION_NEW_ENDPOINT = "org.unifiedpush.android.connector.NEW_ENDPOINT"
        private const val ACTION_MESSAGE = "org.unifiedpush.android.connector.MESSAGE"
        private const val EXTRA_ENDPOINT = "endpoint"
        private const val EXTRA_P256DH = "p256dh"
        private const val EXTRA_AUTH = "auth"
    }
}
