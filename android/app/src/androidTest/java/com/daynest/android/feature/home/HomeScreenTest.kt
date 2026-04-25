package com.daynest.android.feature.home

import androidx.compose.ui.test.assertExists
import androidx.compose.ui.test.hasProgressBarRangeInfo
import androidx.compose.ui.test.junit4.createComposeRule
import com.daynest.android.ui.theme.DaynestTheme
import org.junit.Rule
import org.junit.Test

class HomeScreenTest {
    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun homeScreen_initialRender_showsLoadingIndicator() {
        composeTestRule.setContent {
            DaynestTheme {
                HomeScreen(
                    uiState = HomeUiState.Loading,
                    onEvent = {},
                )
            }
        }

        composeTestRule.onNode(hasProgressBarRangeInfo()).assertExists()
    }
}
