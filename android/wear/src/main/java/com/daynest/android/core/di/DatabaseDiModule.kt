package com.daynest.android.core.di

import android.content.Context
import androidx.room.Room
import com.daynest.android.core.database.DaynestWearDatabase
import com.daynest.android.core.database.sync.CacheEntryDao
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
    fun provideDatabase(@ApplicationContext context: Context): DaynestWearDatabase = Room
        .databaseBuilder(context, DaynestWearDatabase::class.java, "daynest-wear.db")
        .fallbackToDestructiveMigration()
        .build()

    @Provides
    @Singleton
    fun provideCacheEntryDao(database: DaynestWearDatabase): CacheEntryDao = database.cacheEntryDao()
}
