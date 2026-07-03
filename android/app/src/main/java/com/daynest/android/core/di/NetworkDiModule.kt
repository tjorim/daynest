package com.daynest.android.core.di

import com.daynest.android.BuildConfig
import com.daynest.android.core.network.ApiConfig
import com.daynest.android.core.network.AuthInterceptor
import com.daynest.android.core.network.CertificatePinnerProvider
import com.daynest.android.core.network.DynamicBaseUrlInterceptor
import com.daynest.android.core.network.JsonSerializer
import com.daynest.android.core.network.TokenAuthenticator
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
import javax.inject.Named
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
            host = BuildConfig.CERTIFICATE_PIN_HOST,
            pins = BuildConfig.CERTIFICATE_PINS.toList(),
        ).get()

    // Discovery returns the endpoints the whole auth flow trusts, so it must be
    // pinned exactly like the API client; a plain OkHttpClient would let a
    // MITM with a rogue CA swap in attacker-controlled authorization/token URLs.
    @Provides
    @Singleton
    @Named("discovery")
    fun provideDiscoveryOkHttpClient(certificatePinner: CertificatePinner): OkHttpClient =
        OkHttpClient
            .Builder()
            .certificatePinner(certificatePinner)
            .build()

    @Provides
    @Singleton
    fun provideOkHttpClient(
        authInterceptor: AuthInterceptor,
        tokenAuthenticator: TokenAuthenticator,
        certificatePinner: CertificatePinner,
        dynamicBaseUrlInterceptor: DynamicBaseUrlInterceptor,
    ): OkHttpClient =
        OkHttpClient
            .Builder()
            .certificatePinner(certificatePinner)
            .addInterceptor(dynamicBaseUrlInterceptor)
            .addInterceptor(authInterceptor)
            .authenticator(tokenAuthenticator)
            .apply {
                if (BuildConfig.DEBUG) {
                    addInterceptor(
                        HttpLoggingInterceptor().apply {
                            redactHeader("Authorization")
                            level = HttpLoggingInterceptor.Level.BODY
                        },
                    )
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
}
