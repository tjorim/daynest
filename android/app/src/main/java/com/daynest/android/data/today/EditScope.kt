package com.daynest.android.data.today

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
enum class EditScope {
    @SerialName("this")
    THIS,

    @SerialName("future")
    FUTURE,

    @SerialName("all")
    ALL

    ;

    override fun toString(): String = when (this) {
        THIS -> "this"
        FUTURE -> "future"
        ALL -> "all"
    }
}
