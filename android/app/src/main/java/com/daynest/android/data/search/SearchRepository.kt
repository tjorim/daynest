package com.daynest.android.data.search

import com.daynest.android.data.safeApiCall
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SearchRepository
@Inject
constructor(private val searchApi: SearchApi) {
    suspend fun search(query: String, limit: Int = 20): Result<SearchResponseDto> =
        safeApiCall { searchApi.search(query, limit) }
}
