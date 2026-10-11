import { ApiError, type ApiErrorParams } from "@/lib/api/http";
import * as m from "@/paraglide/messages";

type MessageFor = (params: ApiErrorParams | undefined) => string;

/**
 * Translated copy for the stable error codes the server (and the API client) report.
 * `ApiError.message` is an English diagnostic and must never reach the interface;
 * show `apiErrorMessage(error, fallback)` instead.
 */
const messages: Record<string, MessageFor> = {
  network_error: () => m.error_network_error(),
  not_authenticated: () => m.error_not_authenticated(),
  invalid_token: () => m.error_invalid_token(),
  user_inactive: () => m.error_user_inactive(),
  forbidden: () => m.error_forbidden(),
  not_found: () => m.error_not_found(),
  offline_queued: () => m.error_offline_queued(),
  offline_not_saved: () => m.error_offline_not_saved(),
  invalid_response: () => m.error_invalid_response(),
  household_not_found: () => m.error_household_not_found(),
  household_not_a_member: () => m.error_household_not_a_member(),
  household_already_member: () => m.error_household_already_member(),
  household_owner_only: () => m.error_household_owner_only(),
  household_last_owner: () => m.error_household_last_owner(),
  member_not_found: () => m.error_member_not_found(),
  user_email_not_found: () => m.error_user_email_not_found(),
  recurrence_series_not_found: () => m.error_recurrence_series_not_found(),
  recurrence_series_invalid_id: () => m.error_recurrence_series_invalid_id(),
  planned_item_not_found: () => m.error_planned_item_not_found(),
  shopping_list_not_found: () => m.error_shopping_list_not_found(),
  shopping_item_not_found: () => m.error_shopping_item_not_found(),
  task_instance_not_found: () => m.error_task_instance_not_found(),
  chore_instance_not_found: () => m.error_chore_instance_not_found(),
  routine_template_not_found: () => m.error_routine_template_not_found(),
  chore_template_not_found: () => m.error_chore_template_not_found(),
  template_owner_only: () => m.error_template_owner_only(),
  medication_plan_not_found: () => m.error_medication_plan_not_found(),
  medication_dose_instance_not_found: () => m.error_medication_dose_instance_not_found(),
  medication_dose_not_actionable: () => m.error_medication_dose_not_actionable(),
  unsupported_medication_action: () => m.error_unsupported_medication_action(),
  meal_slot_not_found: () => m.error_meal_slot_not_found(),
  meal_plan_not_found: () => m.error_meal_plan_not_found(),
  meal_plan_no_ingredients: () => m.error_meal_plan_no_ingredients(),
  integration_client_not_found: () => m.error_integration_client_not_found(),
  integration_client_revoked: () => m.error_integration_client_revoked(),
  invalid_rrule: () => m.error_invalid_rrule(),
  invalid_timezone: () => m.error_invalid_timezone(),
  taken_at_in_future: () => m.error_taken_at_in_future(),
  days_invalid: () => m.error_days_invalid(),
  end_before_start: () => m.error_end_before_start(),
  calendar_range_too_large: () => m.error_calendar_range_too_large(),
  calendar_token_missing: () => m.error_calendar_token_missing(),
  calendar_token_required: () => m.error_calendar_token_required(),
  calendar_token_generation_failed: () => m.error_calendar_token_generation_failed(),
  calendar_feed_not_found: () => m.error_calendar_feed_not_found(),
  chore_assignee_invalid: () => m.error_chore_assignee_invalid(),
  chore_already_skipped: () => m.error_chore_already_skipped(),
  chore_already_completed: () => m.error_chore_already_completed(),
  chore_not_reschedulable: () => m.error_chore_not_reschedulable(),
  task_already_skipped: () => m.error_task_already_skipped(),
  task_already_completed: () => m.error_task_already_completed(),
  account_deletion_blocked_shared_chores: () => m.error_account_deletion_blocked_shared_chores(),
  account_deletion_blocked_sole_owner: () => m.error_account_deletion_blocked_sole_owner(),
  import_conflict: () => m.error_import_conflict(),
  invalid_import_data: () => m.error_invalid_import_data(),
  unsupported_export_version: (params) =>
    m.error_unsupported_export_version({ version: String(params?.version ?? "") }),
  oidc_unreachable: () => m.error_oidc_unreachable(),
  oidc_not_configured: () => m.error_oidc_not_configured(),
  oidc_session_revoke_failed: () => m.error_oidc_session_revoke_failed(),
  oidc_sessions_unavailable: () => m.error_oidc_sessions_unavailable(),
};

/** The translated message for a known error code, or `null` when the code is missing or unknown. */
export function translateErrorCode(
  code: string | null | undefined,
  params?: ApiErrorParams,
): string | null {
  if (!code || !Object.prototype.hasOwnProperty.call(messages, code)) return null;
  return messages[code]?.(params) ?? null;
}

/**
 * Interface text for a failed operation: the translated message for the error's code when we
 * have one, otherwise the translated `fallback` for the operation. The support id of a failed
 * request is kept so a report can still be traced.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  const message = translateErrorCode(error.code, error.params) ?? fallback;
  return error.requestId ? m.api_with_request_id({ message, id: error.requestId }) : message;
}
