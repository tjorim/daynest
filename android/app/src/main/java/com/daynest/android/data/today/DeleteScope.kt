package com.daynest.android.data.today

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
enum class DeleteScope {
    @SerialName("this")
    THIS,

    @SerialName("future")
    FUTURE,

    ;

    override fun toString(): String =
        when (this) {
            THIS -> "this"
            FUTURE -> "future"
        }
}
