package com.daynest.android.data.push

import retrofit2.http.Body
import retrofit2.http.HTTP
import retrofit2.http.POST

interface PushApi {
    @POST("api/v1/push/subscribe")
    suspend fun subscribe(@Body request: PushSubscriptionRequestDto)

    @HTTP(method = "DELETE", path = "api/v1/push/subscribe", hasBody = true)
    suspend fun unsubscribe(@Body request: PushUnsubscribeRequestDto)
}
