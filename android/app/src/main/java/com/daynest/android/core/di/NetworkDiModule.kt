package com.daynest.android.core.di

import com.daynest.android.BuildConfig
import com.daynest.android.core.network.ApiConfig
import com.daynest.android.core.network.AuthInterceptor
import com.daynest.android.core.network.CertificatePinnerProvider
import com.daynest.android.core.network.DynamicBaseUrlInterceptor
import com.daynest.android.core.network.JsonSerializer
import com.daynest.android.core.network.TokenAuthenticator
import com.daynest.android.data.calendar.CalendarApi
import com.daynest.android.data.medication.MedicationApi
import com.daynest.android.data.settings.SettingsApi
import com.daynest.android.data.templates.TemplatesApi
import com.daynest.android.data.today.PlannedItemApi
import com.daynest.android.data.today.TodayActionsApi
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

    @Provides
    @Singleton
    fun provideTodayApi(retrofit: Retrofit): TodayApi = retrofit.create(TodayApi::class.java)

    @Provides
    @Singleton
    fun provideTodayActionsApi(retrofit: Retrofit): TodayActionsApi = retrofit.create(TodayActionsApi::class.java)

    @Provides
    @Singleton
    fun providePlannedItemApi(retrofit: Retrofit): PlannedItemApi = retrofit.create(PlannedItemApi::class.java)

    @Provides
    @Singleton
    fun provideCalendarApi(retrofit: Retrofit): CalendarApi = retrofit.create(CalendarApi::class.java)

    @Provides
    @Singleton
    fun provideMedicationApi(retrofit: Retrofit): MedicationApi = retrofit.create(MedicationApi::class.java)

    @Provides
    @Singleton
    fun provideTemplatesApi(retrofit: Retrofit): TemplatesApi = retrofit.create(TemplatesApi::class.java)

    @Provides
    @Singleton
    fun provideSettingsApi(retrofit: Retrofit): SettingsApi = retrofit.create(SettingsApi::class.java)
}
