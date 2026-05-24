import { useEffect, useState } from "react";
import * as m from "@/paraglide/messages";
import {
  createMedicationPlan,
  deleteMedicationPlan,
  fetchMedicationHistory,
  isRetryableApiError,
  listMedicationPlans,
  updateMedicationPlan,
  type MedicationHistoryItem,
  type MedicationPlan,
  type MedicationPlanUpdateInput,
} from "@/lib/api/today";
import { formatDate, formatDateTime } from "@/lib/dateUtils";

function todayLocalDate(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function MedicationPage() {
  const [plans, setPlans] = useState<MedicationPlan[]>([]);
  const [history, setHistory] = useState<MedicationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<MedicationPlan | null>(null);
  const [deletingPlanId, setDeletingPlanId] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [startDate, setStartDate] = useState(todayLocalDate);
  const [scheduleTime, setScheduleTime] = useState("09:00:00");
  const [everyNDays, setEveryNDays] = useState("1");

  const loadMedication = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    setCanRetry(false);
    try {
      const [nextPlans, nextHistory] = await Promise.all([
        listMedicationPlans(signal),
        fetchMedicationHistory(signal),
      ]);
      if (!signal?.aborted) {
        setPlans(nextPlans);
        setHistory(nextHistory);
      }
    } catch (err) {
      if (!signal?.aborted) {
        setCanRetry(isRetryableApiError(err));
        setError(err instanceof Error ? err.message : "Unable to load medication data.");
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadMedication(controller.signal);
    return () => controller.abort();
  }, []);

  const onCreatePlan = async () => {
    if (!name.trim() || !instructions.trim()) {
      setSubmitError(m.medication_required_fields());
      return;
    }

    const parsedEvery = parseInt(everyNDays, 10);
    if (!Number.isInteger(parsedEvery) || parsedEvery < 1) {
      setSubmitError(m.medication_every_n_error());
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      await createMedicationPlan({
        name: name.trim(),
        instructions: instructions.trim(),
        start_date: startDate,
        schedule_time: scheduleTime.length === 5 ? `${scheduleTime}:00` : scheduleTime,
        every_n_days: parsedEvery,
      });
      setName("");
      setInstructions("");
      setStartDate(todayLocalDate());
      setScheduleTime("09:00:00");
      setEveryNDays("1");
      setSuccessMessage(m.medication_plan_created());
      await loadMedication();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : m.medication_create_failed());
    } finally {
      setIsSubmitting(false);
    }
  };

  const onUpdatePlan = async (planId: number, input: MedicationPlanUpdateInput) => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      await updateMedicationPlan(planId, input);
      setEditingPlan(null);
      setSuccessMessage(m.medication_plan_updated());
      await loadMedication();
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
      await deleteMedicationPlan(planId);
      setSuccessMessage(m.medication_plan_deleted());
      await loadMedication();
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
            <div className="card-body d-grid gap-2">
              <input
                className="form-control"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setSubmitError(null);
                  setSuccessMessage(null);
                }}
                placeholder={m.medication_name_placeholder()}
              />
              <textarea
                className="form-control"
                rows={3}
                value={instructions}
                onChange={(event) => {
                  setInstructions(event.target.value);
                  setSubmitError(null);
                  setSuccessMessage(null);
                }}
                placeholder={m.medication_instructions_placeholder()}
              />
              <div className="row g-2">
                <div className="col-sm-6">
                  <label className="form-label small fw-semibold mb-1">{m.medication_start_date_label()}</label>
                  <input
                    className="form-control"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </div>
                <div className="col-sm-6">
                  <label className="form-label small fw-semibold mb-1">{m.medication_schedule_time_label()}</label>
                  <input
                    className="form-control"
                    type="time"
                    value={scheduleTime.slice(0, 5)}
                    onChange={(event) => setScheduleTime(event.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="form-label small fw-semibold mb-1">{m.medication_every_n_days_label()}</label>
                <input
                  className="form-control"
                  type="number"
                  min={1}
                  value={everyNDays}
                  onChange={(event) => {
                    setEveryNDays(event.target.value);
                    setSubmitError(null);
                    setSuccessMessage(null);
                  }}
                />
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={isSubmitting}
                onClick={() => void onCreatePlan()}
              >
                {isSubmitting ? m.action_creating() : m.medication_create_button()}
              </button>
            </div>
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
  const [name, setName] = useState(plan.name);
  const [instructions, setInstructions] = useState(plan.instructions);
  const [startDate, setStartDate] = useState(plan.start_date);
  const [scheduleTime, setScheduleTime] = useState(plan.schedule_time.slice(0, 5));
  const [everyNDays, setEveryNDays] = useState(String(plan.every_n_days));
  const [isActive, setIsActive] = useState(plan.is_active);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const parsedEvery = parseInt(everyNDays, 10);
    if (!name.trim() || !instructions.trim()) {
      setError(m.medication_required_fields());
      return;
    }
    if (!Number.isInteger(parsedEvery) || parsedEvery < 1) {
      setError(m.medication_every_n_error());
      return;
    }
    onSubmit({
      name: name.trim(),
      instructions: instructions.trim(),
      start_date: startDate,
      schedule_time: scheduleTime.length === 5 ? `${scheduleTime}:00` : scheduleTime,
      every_n_days: parsedEvery,
      is_active: isActive,
    });
  };

  return (
    <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true">
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h3 className="modal-title h5">{m.medication_edit_title()}</h3>
            <button type="button" className="btn-close" aria-label="Close" onClick={onCancel} />
          </div>
          <div className="modal-body d-grid gap-2">
            {error ? <div className="alert alert-danger py-2">{error}</div> : null}
            <input className="form-control" value={name} onChange={(event) => setName(event.target.value)} />
            <textarea
              className="form-control"
              rows={3}
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
            />
            <div className="row g-2">
              <div className="col-sm-6">
                <label className="form-label small fw-semibold mb-1">{m.medication_start_date_label()}</label>
                <input
                  className="form-control"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
              <div className="col-sm-6">
                <label className="form-label small fw-semibold mb-1">{m.medication_schedule_time_label()}</label>
                <input
                  className="form-control"
                  type="time"
                  value={scheduleTime}
                  onChange={(event) => setScheduleTime(event.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="form-label small fw-semibold mb-1">{m.medication_every_n_days_label()}</label>
              <input
                className="form-control"
                type="number"
                min={1}
                value={everyNDays}
                onChange={(event) => setEveryNDays(event.target.value)}
              />
            </div>
            <label className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              <span className="form-check-label">{m.medication_active_label()}</span>
            </label>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>
              {m.action_cancel()}
            </button>
            <button type="button" className="btn btn-primary" disabled={isSubmitting} onClick={submit}>
              {isSubmitting ? m.action_saving() : m.action_save()}
            </button>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </div>
  );
}
