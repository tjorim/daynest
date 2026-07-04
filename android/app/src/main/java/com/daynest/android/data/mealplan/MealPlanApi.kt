package com.daynest.android.data.mealplan

import com.daynest.android.data.shopping.ShoppingListDto
import com.daynest.android.data.today.PlannedTodayItemDto
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

interface MealPlanApi {
    @GET("api/meal-plans")
    suspend fun listMealPlans(): List<MealPlanDto>

    @POST("api/meal-plans")
    suspend fun createMealPlan(@Body request: MealPlanCreateDto): MealPlanDto

    @GET("api/meal-plans/{mealPlanId}/slots")
    suspend fun getWeekPlan(@Path("mealPlanId") mealPlanId: Int): WeekGridDto

    @PUT("api/meal-plans/{mealPlanId}/slots/{slotId}")
    suspend fun updateSlot(
        @Path("mealPlanId") mealPlanId: Int,
        @Path("slotId") slotId: Int,
        @Body request: MealSlotUpdateDto
    ): MealSlotDto

    @POST("api/meal-plans/{mealPlanId}/generate-shopping-list")
    suspend fun generateShoppingList(@Path("mealPlanId") mealPlanId: Int): GenerateShoppingListDto
}

@Serializable
data class MealPlanDto(
    val id: Int,
    @SerialName("user_id")
    val userId: Int = 0,
    val name: String,
    @SerialName("week_start")
    val weekStart: String,
    val notes: String? = null,
    @SerialName("created_at")
    val createdAt: String = ""
)

@Serializable
data class MealPlanCreateDto(
    val name: String,
    @SerialName("week_start")
    val weekStart: String,
    val notes: String? = null
)

@Serializable
data class MealSlotDto(
    val id: Int,
    @SerialName("meal_plan_id")
    val mealPlanId: Int,
    @SerialName("slot_date")
    val slotDate: String,
    @SerialName("slot_type")
    val slotType: String,
    val title: String = "",
    @SerialName("recipe_url")
    val recipeUrl: String? = null,
    @SerialName("ingredients_json")
    val ingredients: List<String> = emptyList(),
    @SerialName("planned_item_id")
    val plannedItemId: Int? = null
)

@Serializable
data class MealSlotUpdateDto(
    val title: String? = null,
    @SerialName("recipe_url")
    val recipeUrl: String? = null,
    @SerialName("ingredients_json")
    val ingredients: List<String>? = null,
    @SerialName("planned_item_id")
    val plannedItemId: Int? = null
)

@Serializable
data class WeekDayDto(val date: String, val slots: Map<String, MealSlotDto> = emptyMap())

@Serializable
data class WeekGridDto(
    @SerialName("meal_plan")
    val mealPlan: MealPlanDto,
    val days: List<WeekDayDto> = emptyList()
)

@Serializable
data class GenerateShoppingListDto(
    @SerialName("shopping_list")
    val shoppingList: ShoppingListDto,
    val items: List<PlannedTodayItemDto> = emptyList()
)
