@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.legal

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.daynest.android.R

@Composable
fun PrivacyPolicyRoute(onBack: () -> Unit) {
    val uriHandler = LocalUriHandler.current
    val contactEmail = stringResource(id = R.string.privacy_page_contact_email)

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            TextButton(onClick = onBack) {
                Text(text = stringResource(id = R.string.action_back))
            }
        }
        item {
            Text(
                text = stringResource(id = R.string.privacy_page_title),
                style = MaterialTheme.typography.headlineMedium
            )
        }
        item {
            Text(
                text =
                stringResource(
                    id = R.string.privacy_page_last_updated,
                    stringResource(id = R.string.privacy_page_last_updated_date)
                ),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.outline
            )
        }
        privacyParagraph(R.string.privacy_page_intro)
        privacyParagraph(R.string.privacy_page_self_hosting)
        privacySectionTitle(R.string.privacy_page_data_collected_title)
        privacySubsection(R.string.privacy_page_account_title, R.string.privacy_page_account_body)
        privacySubsection(R.string.privacy_page_household_data_title, R.string.privacy_page_household_data_body)
        privacySubsection(R.string.privacy_page_medication_title, R.string.privacy_page_medication_body)
        privacySubsection(R.string.privacy_page_calendar_title, R.string.privacy_page_calendar_body)
        privacySubsection(R.string.privacy_page_notifications_title, R.string.privacy_page_notifications_body)
        privacySubsection(R.string.privacy_page_integrations_title, R.string.privacy_page_integrations_body)
        privacySubsection(R.string.privacy_page_diagnostics_title, R.string.privacy_page_diagnostics_body)
        privacySectionTitle(R.string.privacy_page_data_use_title)
        privacyParagraph(R.string.privacy_page_data_use_body)
        privacySectionTitle(R.string.privacy_page_sharing_title)
        privacyParagraph(R.string.privacy_page_sharing_intro)
        privacyBullet(R.string.privacy_page_sharing_hosting)
        privacyBullet(R.string.privacy_page_sharing_sentry)
        privacyBullet(R.string.privacy_page_sharing_push)
        privacyParagraph(R.string.privacy_page_sharing_outro)
        privacySectionTitle(R.string.privacy_page_retention_title)
        privacyParagraph(R.string.privacy_page_retention_body)
        privacySectionTitle(R.string.privacy_page_security_title)
        privacyParagraph(R.string.privacy_page_security_body)
        privacySectionTitle(R.string.privacy_page_children_title)
        privacyParagraph(R.string.privacy_page_children_body)
        privacySectionTitle(R.string.privacy_page_changes_title)
        privacyParagraph(R.string.privacy_page_changes_body)
        privacySectionTitle(R.string.privacy_page_contact_title)
        privacyParagraph(R.string.privacy_page_contact_body)
        item {
            TextButton(onClick = { uriHandler.openUri("mailto:$contactEmail") }) {
                Text(text = contactEmail)
            }
        }
    }
}

private fun LazyListScope.privacySectionTitle(titleRes: Int) {
    item {
        Text(
            text = stringResource(id = titleRes),
            style = MaterialTheme.typography.titleLarge
        )
    }
}

private fun LazyListScope.privacySubsection(titleRes: Int, bodyRes: Int) {
    item {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                text = stringResource(id = titleRes),
                style = MaterialTheme.typography.titleMedium
            )
            Text(
                text = stringResource(id = bodyRes),
                style = MaterialTheme.typography.bodyMedium
            )
        }
    }
}

private fun LazyListScope.privacyParagraph(bodyRes: Int) {
    item {
        Text(
            text = stringResource(id = bodyRes),
            style = MaterialTheme.typography.bodyMedium
        )
    }
}

private fun LazyListScope.privacyBullet(bodyRes: Int) {
    item {
        Text(
            text = "• ${stringResource(id = bodyRes)}",
            style = MaterialTheme.typography.bodyMedium
        )
    }
}
