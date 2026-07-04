package com.daynest.android.core.auth

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AuthDiModule {
    @Provides
    @Singleton
    fun provideOidcConfig(): OidcConfig = OidcConfig()
}
