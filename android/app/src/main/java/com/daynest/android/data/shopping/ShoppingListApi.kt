package com.daynest.android.data.shopping

import com.daynest.android.data.today.PlannedTodayItemDto
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

interface ShoppingListApi {
    @GET("api/shopping-lists")
    suspend fun listShoppingLists(
        @Query("status") status: String = "active",
    ): List<ShoppingListDto>

    @POST("api/shopping-lists")
    suspend fun createShoppingList(
        @Body request: ShoppingListCreateDto,
    ): ShoppingListDto

    @GET("api/shopping-lists/{id}")
    suspend fun getShoppingList(
        @Path("id") id: Int,
    ): ShoppingListDto

    @PUT("api/shopping-lists/{id}")
    suspend fun updateShoppingList(
        @Path("id") id: Int,
        @Body request: ShoppingListUpdateDto,
    ): ShoppingListDto

    @DELETE("api/shopping-lists/{id}")
    suspend fun deleteShoppingList(
        @Path("id") id: Int,
    )

    @POST("api/shopping-lists/{id}/import-recurring")
    suspend fun importRecurring(
        @Path("id") id: Int,
    ): List<PlannedTodayItemDto>
}

@Serializable
data class ShoppingListDto(
    val id: Int,
    @SerialName("user_id")
    val userId: Int,
    val name: String,
    val store: String? = null,
    val notes: String? = null,
    val status: String = ShoppingListStatus.ACTIVE,
    @SerialName("created_at")
    val createdAt: String = "",
)

@Serializable
data class ShoppingListCreateDto(
    val name: String,
    val store: String? = null,
    val notes: String? = null,
)

@Serializable
data class ShoppingListUpdateDto(
    val name: String? = null,
    val store: String? = null,
    val notes: String? = null,
    val status: String? = null,
)

object ShoppingListStatus {
    const val ACTIVE = "active"
    const val ARCHIVED = "archived"
    const val ALL = "all"
}
