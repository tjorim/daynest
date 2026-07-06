package com.daynest.android.core.di

import com.daynest.android.data.analytics.AnalyticsApi
import com.daynest.android.data.calendar.CalendarApi
import com.daynest.android.data.mealplan.MealPlanApi
import com.daynest.android.data.medication.MedicationApi
import com.daynest.android.data.push.PushApi
import com.daynest.android.data.settings.SettingsApi
import com.daynest.android.data.shopping.ShoppingListApi
import com.daynest.android.data.templates.TemplatesApi
import com.daynest.android.data.today.PlannedItemApi
import com.daynest.android.data.today.TodayActionsApi
import com.daynest.android.data.today.TodayApi
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton
import retrofit2.Retrofit

@Module
@InstallIn(SingletonComponent::class)
object NetworkApiDiModule {
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

    @Provides
    @Singleton
    fun providePushApi(retrofit: Retrofit): PushApi = retrofit.create(PushApi::class.java)

    @Provides
    @Singleton
    fun provideShoppingListApi(retrofit: Retrofit): ShoppingListApi = retrofit.create(ShoppingListApi::class.java)

    @Provides
    @Singleton
    fun provideMealPlanApi(retrofit: Retrofit): MealPlanApi = retrofit.create(MealPlanApi::class.java)

    @Provides
    @Singleton
    fun provideAnalyticsApi(retrofit: Retrofit): AnalyticsApi = retrofit.create(AnalyticsApi::class.java)
}
