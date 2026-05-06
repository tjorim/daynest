package com.daynest.android.core.di

import com.daynest.android.BuildConfig
import com.daynest.android.core.network.ApiConfig
import com.daynest.android.core.network.AuthInterceptor
import com.daynest.android.core.network.CertificatePinnerProvider
import com.daynest.android.core.network.JsonSerializer
import com.daynest.android.core.network.TokenAuthenticator
import com.daynest.android.data.auth.AuthApi
import com.daynest.android.data.today.TodayApi
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.serialization.json.Json
import okhttp3.CertificatePinner
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkDiModule {
    @Provides
    @Singleton
    fun provideJson(): Json = JsonSerializer.config

    @Provides
    @Singleton
    fun provideCertificatePinner(): CertificatePinner =
        CertificatePinnerProvider(
            host = BuildConfig.PROD_HOST,
            pins = BuildConfig.PROD_PINS.toList(),
        ).get()

    @Provides
    @Singleton
    fun provideOkHttpClient(
        authInterceptor: AuthInterceptor,
        tokenAuthenticator: TokenAuthenticator,
        certificatePinner: CertificatePinner,
    ): OkHttpClient =
        OkHttpClient
            .Builder()
            .certificatePinner(certificatePinner)
            .addInterceptor(authInterceptor)
            .authenticator(tokenAuthenticator)
            .apply {
                if (BuildConfig.DEBUG) {
                    addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BODY })
                }
            }.build()

    @Provides
    @Singleton
    fun provideRetrofit(
        okHttpClient: OkHttpClient,
        json: Json,
    ): Retrofit =
        Retrofit
            .Builder()
            .baseUrl(ApiConfig.baseUrl)
            .client(okHttpClient)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()

    @Provides
    @Singleton
    fun provideTodayApi(retrofit: Retrofit): TodayApi = retrofit.create(TodayApi::class.java)

    @Provides
    @Singleton
    fun provideAuthApi(retrofit: Retrofit): AuthApi = retrofit.create(AuthApi::class.java)
}
