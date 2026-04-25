package com.daynest.android.core.network

import com.daynest.android.BuildConfig
import com.daynest.android.data.today.TodayApi
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

class NetworkModule(
    baseUrl: String,
    isDebug: Boolean,
    json: Json = JsonSerializer.config,
) {
    private val jsonMediaType = "application/json".toMediaType()

    private val okHttpClient: OkHttpClient = OkHttpClient.Builder()
        .apply {
            if (isDebug) {
                addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC })
            }
        }
        .build()

    private val retrofit: Retrofit = Retrofit.Builder()
        .baseUrl(baseUrl)
        .client(okHttpClient)
        .addConverterFactory(json.asConverterFactory(jsonMediaType))
        .build()

    val todayApi: TodayApi = retrofit.create(TodayApi::class.java)

    companion object {
        fun default(): NetworkModule = NetworkModule(
            baseUrl = ApiConfig.baseUrl,
            isDebug = BuildConfig.DEBUG,
        )
    }
}
