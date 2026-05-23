package com.daynest.android.core.di

import android.content.Context
import androidx.room.Room
import com.daynest.android.core.database.DaynestDatabase
import com.daynest.android.core.database.sync.CacheEntryDao
import com.daynest.android.core.database.sync.PendingMutationDao
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
            .fallbackToDestructiveMigration(dropAllTables = true)
            .build()

    @Provides
    @Singleton
    fun provideTodaySummaryDao(database: DaynestDatabase): TodaySummaryDao = database.todaySummaryDao()

    @Provides
    @Singleton
    fun provideCacheEntryDao(database: DaynestDatabase): CacheEntryDao = database.cacheEntryDao()

    @Provides
    @Singleton
    fun providePendingMutationDao(database: DaynestDatabase): PendingMutationDao = database.pendingMutationDao()
}
