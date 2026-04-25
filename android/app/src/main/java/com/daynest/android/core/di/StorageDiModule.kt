package com.daynest.android.core.di

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.daynest.android.core.storage.EncryptedTokenStorage
import com.daynest.android.core.storage.SecureTokenStorage
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class StorageDiModule {
    @Binds
    @Singleton
    abstract fun bindSecureTokenStorage(encryptedTokenStorage: EncryptedTokenStorage): SecureTokenStorage

    companion object {
        @Provides
        @Singleton
        fun provideSecurePreferences(
            @ApplicationContext context: Context,
        ): SharedPreferences {
            val masterKey =
                MasterKey
                    .Builder(context)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build()

            return EncryptedSharedPreferences.create(
                context,
                "daynest_secure_store",
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
        }
    }
}
