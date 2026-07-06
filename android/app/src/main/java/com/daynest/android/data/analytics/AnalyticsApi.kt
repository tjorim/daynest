package com.daynest.android.data.analytics

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.http.GET
import retrofit2.http.Query

interface AnalyticsApi {
    @GET("api/analytics/summary")
    suspend fun getSummary(@Query("period") period: String): AnalyticsSummaryDto
}

@Serializable
data class DailyCountDto(
    val date: String,
    val completed: Int,
    val total: Int,
    @SerialName("completion_rate")
    val completionRate: Double
)

@Serializable
data class DailyAdherenceDto(
    val date: String,
    val taken: Int,
    val total: Int,
    @SerialName("adherence_rate")
    val adherenceRate: Double
)

@Serializable
data class ChoreStreakDto(
    @SerialName("chore_id")
    val choreId: Int,
    val name: String,
    @SerialName("current_streak")
    val currentStreak: Int,
    @SerialName("longest_streak")
    val longestStreak: Int
)

@Serializable
data class RoutineStreakDto(
    @SerialName("routine_id")
    val routineId: Int,
    val name: String,
    @SerialName("current_streak")
    val currentStreak: Int,
    @SerialName("longest_streak")
    val longestStreak: Int
)

@Serializable
data class SkippedChoreDto(
    @SerialName("chore_id")
    val choreId: Int,
    val name: String,
    @SerialName("skip_count")
    val skipCount: Int
)

@Serializable
data class ChoreStatsDto(
    @SerialName("completion_rate")
    val completionRate: Double,
    @SerialName("total_completed")
    val totalCompleted: Int,
    @SerialName("total_scheduled")
    val totalScheduled: Int,
    @SerialName("daily_completions")
    val dailyCompletions: List<DailyCountDto>,
    val streaks: List<ChoreStreakDto>,
    @SerialName("most_skipped")
    val mostSkipped: List<SkippedChoreDto>
)

@Serializable
data class MedicationStatsDto(
    @SerialName("adherence_rate")
    val adherenceRate: Double,
    @SerialName("total_taken")
    val totalTaken: Int,
    @SerialName("total_scheduled")
    val totalScheduled: Int,
    @SerialName("daily_adherence")
    val dailyAdherence: List<DailyAdherenceDto>
)

@Serializable
data class PlannedItemStatsDto(
    @SerialName("completion_rate")
    val completionRate: Double,
    @SerialName("total_completed")
    val totalCompleted: Int,
    @SerialName("total_scheduled")
    val totalScheduled: Int,
    @SerialName("daily_completions")
    val dailyCompletions: List<DailyCountDto>
)

@Serializable
data class RoutineStatsDto(
    @SerialName("completion_rate")
    val completionRate: Double,
    @SerialName("total_completed")
    val totalCompleted: Int,
    @SerialName("total_scheduled")
    val totalScheduled: Int,
    @SerialName("daily_completions")
    val dailyCompletions: List<DailyCountDto>,
    val streaks: List<RoutineStreakDto>
)

@Serializable
data class AnalyticsSummaryDto(
    val period: String,
    @SerialName("start_date")
    val startDate: String,
    @SerialName("end_date")
    val endDate: String,
    val chores: ChoreStatsDto,
    val medications: MedicationStatsDto,
    @SerialName("planned_items")
    val plannedItems: PlannedItemStatsDto,
    val routines: RoutineStatsDto
)
