package com.daynest.android.core.di

import android.content.Context
import androidx.room.Room
import com.daynest.android.core.database.DaynestDatabase
import com.daynest.android.core.database.today.TodaySummaryDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseDiModule {
    @Provides
    @Singleton
    fun provideDaynestDatabase(
        @ApplicationContext context: Context,
    ): DaynestDatabase =
        Room
            .databaseBuilder(context, DaynestDatabase::class.java, "daynest.db")
            .build()

    @Provides
    @Singleton
    fun provideTodaySummaryDao(database: DaynestDatabase): TodaySummaryDao = database.todaySummaryDao()
}
