package com.daynest.android.core.di

import android.content.Context
import androidx.room.Room
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.daynest.android.core.database.DaynestDatabase
import com.daynest.android.core.database.sync.CacheEntryDao
import com.daynest.android.core.database.sync.PendingMutationDao
import com.daynest.android.core.database.sync.SyncNoticeDao
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
    fun provideDaynestDatabase(@ApplicationContext context: Context): DaynestDatabase = Room
        .databaseBuilder(context, DaynestDatabase::class.java, "daynest.db")
        .addMigrations(MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4)
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

    @Provides
    @Singleton
    fun provideSyncNoticeDao(database: DaynestDatabase): SyncNoticeDao = database.syncNoticeDao()

    private val MIGRATION_1_2 =
        object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS pending_mutations (
                        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                        kind TEXT NOT NULL,
                        payload TEXT NOT NULL,
                        createdAtEpochMillis INTEGER NOT NULL,
                        attempts INTEGER NOT NULL
                    )
                    """.trimIndent()
                )
            }
        }

    private val MIGRATION_2_3 =
        object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE pending_mutations ADD COLUMN remoteAppliedAtEpochMillis INTEGER")
            }
        }

    private val MIGRATION_3_4 =
        object : Migration(3, 4) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS sync_notices (
                        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                        message TEXT NOT NULL,
                        createdAtEpochMillis INTEGER NOT NULL,
                        consumedAtEpochMillis INTEGER
                    )
                    """.trimIndent()
                )
            }
        }
}
