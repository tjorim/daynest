package com.daynest.android.core.di

import com.daynest.android.data.today.TodayApi
import com.daynest.android.data.today.TodayRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object RepositoryModule {

    @Provides
    @Singleton
    fun provideTodayRepository(todayApi: TodayApi): TodayRepository = TodayRepository(todayApi)
}
