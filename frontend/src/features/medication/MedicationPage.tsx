import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import * as m from "@/paraglide/messages";
import { isRetryableApiError } from "@/lib/api/http";
import {
  type MedicationPlan,
  type MedicationPlanUpdateInput,
} from "@/lib/api/medications";
import { formatDate, formatDateTime } from "@/lib/dateUtils";
import {
  useCreateMedicationPlanMutation,
  useDeleteMedicationPlanMutation,
  useMedicationHistoryQuery,
  useMedicationPlansQuery,
  useUpdateMedicationPlanMutation,
} from "@/features/medication/useMedicationQueries";

const medicationPlanFormSchema = z.object({
  name: z.string().trim().min(1),
  instructions: z.string().trim().min(1),
  startDate: z.string().trim().min(1),
  scheduleTime: z.string().trim().min(1),
  everyNDays: z.coerce.number().int().min(1),
  isActive: z.boolean().optional(),
});

type MedicationPlanFormValues = {
  name: string;
  instructions: string;
  startDate: string;
  scheduleTime: string;
  everyNDays: string;
  isActive?: boolean;
};

function todayLocalDate(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function toMedicationPlanInput(
  values: MedicationPlanFormValues,
): { input: MedicationPlanUpdateInput | null; error: string | null } {
  const parsed = medicationPlanFormSchema.safeParse(values);
  if (!parsed.success) {
    const hasEveryNDaysIssue = parsed.error.issues.some((issue) => issue.path.includes("everyNDays"));
    return {
      input: null,
      error: hasEveryNDaysIssue ? m.medication_every_n_error() : m.medication_required_fields(),
    };
  }

  const { name, instructions, startDate, scheduleTime, everyNDays, isActive } = parsed.data;
  return {
    input: {
      name: name.trim(),
      instructions: instructions.trim(),
      start_date: startDate,
      schedule_time: scheduleTime.length === 5 ? `${scheduleTime}:00` : scheduleTime,
      every_n_days: everyNDays,
      is_active: isActive ?? true,
    },
    error: null,
  };
}

export function MedicationPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<MedicationPlan | null>(null);
  const [deletingPlanId, setDeletingPlanId] = useState<number | null>(null);

  const plansQuery = useMedicationPlansQuery();
  const historyQuery = useMedicationHistoryQuery();
  const createPlanMutation = useCreateMedicationPlanMutation();
  const updatePlanMutation = useUpdateMedicationPlanMutation();
  const deletePlanMutation = useDeleteMedicationPlanMutation();

  const plans = plansQuery.data ?? [];
  const history = historyQuery.data ?? [];
  const loading = plansQuery.isPending || historyQuery.isPending;
  const queryError = plansQuery.error ?? historyQuery.error;
  const error = queryError instanceof Error ? queryError.message : queryError ? "Unable to load medication data." : null;
  const canRetry = queryError ? isRetryableApiError(queryError) : false;

  const createForm = useForm({
    defaultValues: {
      name: "",
      instructions: "",
      startDate: todayLocalDate(),
      scheduleTime: "09:00",
      everyNDays: "1",
    },
    onSubmit: async ({ value, formApi }) => {
      const parsed = toMedicationPlanInput(value);
      if (parsed.error || !parsed.input) {
        setSubmitError(parsed.error ?? m.medication_create_failed());
        return;
      }

      setIsSubmitting(true);
      setSubmitError(null);
      setSuccessMessage(null);

      try {
        await createPlanMutation.mutateAsync(parsed.input);
        formApi.reset({
          name: "",
          instructions: "",
          startDate: todayLocalDate(),
          scheduleTime: "09:00",
          everyNDays: "1",
        });
        setSuccessMessage(m.medication_plan_created());
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : m.medication_create_failed());
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  const loadMedication = async () => {
    await Promise.all([plansQuery.refetch(), historyQuery.refetch()]);
  };

  const onUpdatePlan = async (planId: number, input: MedicationPlanUpdateInput) => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      await updatePlanMutation.mutateAsync({ planId, input });
      setEditingPlan(null);
      setSuccessMessage(m.medication_plan_updated());
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : m.medication_update_failed());
    } finally {
      setIsSubmitting(false);
    }
  };

  const onDeletePlan = async (planId: number) => {
    setDeletingPlanId(planId);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      await deletePlanMutation.mutateAsync(planId);
      setSuccessMessage(m.medication_plan_deleted());
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : m.medication_delete_failed());
    } finally {
      setDeletingPlanId(null);
    }
  };

  return (
    <section>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 mb-2">
        <h2 className="h4 mb-0">{m.medication_title()}</h2>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          disabled={loading}
          onClick={() => void loadMedication()}
        >
          {m.action_refresh()}
        </button>
      </div>
      <p className="text-muted mb-3">
        {m.medication_subtitle()}
      </p>

      {loading ? <div className="alert alert-info py-2">{m.medication_loading()}</div> : null}
      {error ? (
        <div className="alert alert-danger py-2 d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <span>{error}</span>
          {canRetry ? (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => void loadMedication()}
            >
              {m.action_retry()}
            </button>
          ) : null}
        </div>
      ) : null}
      {successMessage ? <div className="alert alert-success py-2">{successMessage}</div> : null}

      <div className="row g-3">
        <div className="col-lg-5">
          <div className="card mb-3">
            <div className="card-header fw-semibold py-2">{m.medication_create_plan_header()}</div>
            <form
              className="card-body d-grid gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void createForm.handleSubmit();
              }}
            >
              <createForm.Field
                name="name"
                children={(field) => (
                  <input
                    className="form-control"
                    value={field.state.value}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                      setSubmitError(null);
                      setSuccessMessage(null);
                    }}
                    placeholder={m.medication_name_placeholder()}
                    aria-label={m.medication_name_placeholder()}
                  />
                )}
              />
              <createForm.Field
                name="instructions"
                children={(field) => (
                  <textarea
                    className="form-control"
                    rows={3}
                    value={field.state.value}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                      setSubmitError(null);
                      setSuccessMessage(null);
                    }}
                    placeholder={m.medication_instructions_placeholder()}
                    aria-label={m.medication_instructions_placeholder()}
                  />
                )}
              />
              <div className="row g-2">
                <div className="col-sm-6">
                  <label className="form-label small fw-semibold mb-1">{m.medication_start_date_label()}</label>
                  <createForm.Field
                    name="startDate"
                    children={(field) => (
                      <input
                        className="form-control"
                        type="date"
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                    )}
                  />
                </div>
                <div className="col-sm-6">
                  <label className="form-label small fw-semibold mb-1">{m.medication_schedule_time_label()}</label>
                  <createForm.Field
                    name="scheduleTime"
                    children={(field) => (
                      <input
                        className="form-control"
                        type="time"
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                    )}
                  />
                </div>
              </div>
              <div>
                <label className="form-label small fw-semibold mb-1">{m.medication_every_n_days_label()}</label>
                <createForm.Field
                  name="everyNDays"
                  children={(field) => (
                    <input
                      className="form-control"
                      type="number"
                      min={1}
                      value={field.state.value}
                      onChange={(event) => {
                        field.handleChange(event.target.value);
                        setSubmitError(null);
                        setSuccessMessage(null);
                      }}
                    />
                  )}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? m.action_creating() : m.medication_create_button()}
              </button>
            </form>
            {submitError ? (
              <div className="card-footer text-danger py-2 small">{submitError}</div>
            ) : null}
          </div>

          <div className="card">
            <div className="card-header fw-semibold py-2">{m.medication_active_plans_header()}</div>
            <ul className="list-group list-group-flush">
              {plans.length === 0 ? (
                <li className="list-group-item py-2 text-muted">{m.medication_no_plans()}</li>
              ) : (
                plans.map((plan) => (
                  <li key={plan.id} className="list-group-item py-2">
                    <div className="d-flex justify-content-between align-items-start gap-3 flex-column flex-sm-row">
                      <div>
                        <div className="fw-semibold">{plan.name}</div>
                        <small className="text-muted d-block">
                          {m.medication_starts({ date: formatDate(plan.start_date) })} • {plan.schedule_time.slice(0, 5)} •{" "}
                          {plan.every_n_days === 1
                            ? m.medication_every_day({ count: plan.every_n_days })
                            : m.medication_every_days({ count: plan.every_n_days })}
                        </small>
                        <small className="d-block mt-1">{plan.instructions}</small>
                      </div>
                      <div className="d-flex gap-2 align-items-center flex-wrap">
                        <span
                          className={`badge align-self-start ${plan.is_active ? "text-bg-success" : "text-bg-secondary"}`}
                        >
                          {plan.is_active ? m.status_active() : m.status_inactive()}
                        </span>
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => setEditingPlan(plan)}
                        >
                          {m.action_edit()}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          disabled={deletingPlanId === plan.id}
                          onClick={() => void onDeletePlan(plan.id)}
                        >
                          {deletingPlanId === plan.id ? m.action_deleting() : m.action_delete()}
                        </button>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        <div className="col-lg-7">
          <div className="card">
            <div className="card-header fw-semibold py-2">{m.medication_dose_history_header()}</div>
            <ul className="list-group list-group-flush">
              {history.length === 0 ? (
                <li className="list-group-item py-2 text-muted">{m.medication_no_history()}</li>
              ) : (
                history.map((item) => (
                  <li key={item.medication_dose_instance_id} className="list-group-item py-2">
                    <div className="d-flex justify-content-between align-items-start gap-3">
                      <div>
                        <div className="fw-semibold">{item.name}</div>
                        <small className="text-muted d-block">
                          {formatDateTime(item.scheduled_at)} • {item.status}
                        </small>
                        <small className="d-block mt-1">{item.instructions}</small>
                      </div>
                      <span
                        className={`badge ${item.status === "taken" ? "text-bg-success" : item.status === "scheduled" ? "text-bg-info" : "text-bg-secondary"}`}
                      >
                        {item.status}
                      </span>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
      {editingPlan ? (
        <EditMedicationPlanDialog
          plan={editingPlan}
          isSubmitting={isSubmitting}
          onCancel={() => setEditingPlan(null)}
          onSubmit={(input) => void onUpdatePlan(editingPlan.id, input)}
        />
      ) : null}
    </section>
  );
}

function EditMedicationPlanDialog({
  plan,
  isSubmitting,
  onCancel,
  onSubmit,
}: {
  plan: MedicationPlan;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (input: MedicationPlanUpdateInput) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const editForm = useForm({
    defaultValues: {
      name: plan.name,
      instructions: plan.instructions,
      startDate: plan.start_date,
      scheduleTime: plan.schedule_time.slice(0, 5),
      everyNDays: String(plan.every_n_days),
      isActive: plan.is_active,
    },
    onSubmit: ({ value }) => {
      const parsed = toMedicationPlanInput(value);
      if (parsed.error || !parsed.input) {
        setError(parsed.error ?? m.medication_update_failed());
        return;
      }
      setError(null);
      onSubmit(parsed.input);
    },
  });

  return (
    <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true">
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h3 className="modal-title h5">{m.medication_edit_title()}</h3>
            <button type="button" className="btn-close" aria-label="Close" onClick={onCancel} />
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void editForm.handleSubmit();
            }}
          >
            <div className="modal-body d-grid gap-2">
            {error ? <div className="alert alert-danger py-2">{error}</div> : null}
            <editForm.Field
              name="name"
              children={(field) => (
                <input
                  className="form-control"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  aria-label={m.medication_name_placeholder()}
                />
              )}
            />
            <editForm.Field
              name="instructions"
              children={(field) => (
                <textarea
                  className="form-control"
                  rows={3}
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  aria-label={m.medication_instructions_placeholder()}
                />
              )}
            />
            <div className="row g-2">
              <div className="col-sm-6">
                <label className="form-label small fw-semibold mb-1">{m.medication_start_date_label()}</label>
                <editForm.Field
                  name="startDate"
                  children={(field) => (
                    <input
                      className="form-control"
                      type="date"
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                  )}
                />
              </div>
              <div className="col-sm-6">
                <label className="form-label small fw-semibold mb-1">{m.medication_schedule_time_label()}</label>
                <editForm.Field
                  name="scheduleTime"
                  children={(field) => (
                    <input
                      className="form-control"
                      type="time"
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                  )}
                />
              </div>
            </div>
            <div>
              <label className="form-label small fw-semibold mb-1">{m.medication_every_n_days_label()}</label>
              <editForm.Field
                name="everyNDays"
                children={(field) => (
                  <input
                    className="form-control"
                    type="number"
                    min={1}
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                )}
              />
            </div>
            <label className="form-check">
              <editForm.Field
                name="isActive"
                children={(field) => (
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={field.state.value}
                    onChange={(event) => field.handleChange(event.target.checked)}
                  />
                )}
              />
              <span className="form-check-label">{m.medication_active_label()}</span>
            </label>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>
                {m.action_cancel()}
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? m.action_saving() : m.action_save()}
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </div>
  );
}
