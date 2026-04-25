package com.daynest.android.core.network

import com.daynest.android.BuildConfig
import com.daynest.android.data.today.TodayApi
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

object NetworkModule {
    private val jsonMediaType = "application/json".toMediaType()

    private val okHttpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .apply {
                if (BuildConfig.DEBUG) {
                    addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC })
                }
            }
            .build()
    }

    private val retrofit: Retrofit by lazy {
        Retrofit.Builder()
            .baseUrl(ApiConfig.baseUrl)
            .client(okHttpClient)
            .addConverterFactory(JsonSerializer.config.asConverterFactory(jsonMediaType))
            .build()
    }

    val todayApi: TodayApi by lazy {
        retrofit.create(TodayApi::class.java)
    }
}
