import { useEffect, useState } from "react";
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
      setSubmitError("Name and instructions are required.");
      return;
    }

    const parsedEvery = parseInt(everyNDays, 10);
    if (!Number.isInteger(parsedEvery) || parsedEvery < 1) {
      setSubmitError("Every N days must be a positive integer.");
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
      setSuccessMessage("Medication plan created.");
      await loadMedication();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create medication plan.");
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
      setSuccessMessage("Medication plan updated.");
      await loadMedication();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to update medication plan.");
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
      setSuccessMessage("Medication plan deleted.");
      await loadMedication();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to delete medication plan.");
    } finally {
      setDeletingPlanId(null);
    }
  };

  return (
    <section>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 mb-2">
        <h2 className="h4 mb-0">Medication</h2>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          disabled={loading}
          onClick={() => void loadMedication()}
        >
          Refresh
        </button>
      </div>
      <p className="text-muted mb-3">
        Manage recurring medication plans and review recent dose history outside the Today workflow.
      </p>

      {loading ? <div className="alert alert-info py-2">Loading medication...</div> : null}
      {error ? (
        <div className="alert alert-danger py-2 d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <span>{error}</span>
          {canRetry ? (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => void loadMedication()}
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
      {successMessage ? <div className="alert alert-success py-2">{successMessage}</div> : null}

      <div className="row g-3">
        <div className="col-lg-5">
          <div className="card mb-3">
            <div className="card-header fw-semibold py-2">Create medication plan</div>
            <div className="card-body d-grid gap-2">
              <input
                className="form-control"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setSubmitError(null);
                  setSuccessMessage(null);
                }}
                placeholder="Medication name"
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
                placeholder="Instructions"
              />
              <div className="row g-2">
                <div className="col-sm-6">
                  <label className="form-label small fw-semibold mb-1">Start date</label>
                  <input
                    className="form-control"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </div>
                <div className="col-sm-6">
                  <label className="form-label small fw-semibold mb-1">Schedule time</label>
                  <input
                    className="form-control"
                    type="time"
                    value={scheduleTime.slice(0, 5)}
                    onChange={(event) => setScheduleTime(event.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="form-label small fw-semibold mb-1">Every N days</label>
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
                {isSubmitting ? "Creating…" : "Create plan"}
              </button>
            </div>
            {submitError ? (
              <div className="card-footer text-danger py-2 small">{submitError}</div>
            ) : null}
          </div>

          <div className="card">
            <div className="card-header fw-semibold py-2">Active plans</div>
            <ul className="list-group list-group-flush">
              {plans.length === 0 ? (
                <li className="list-group-item py-2 text-muted">No medication plans yet.</li>
              ) : (
                plans.map((plan) => (
                  <li key={plan.id} className="list-group-item py-2">
                    <div className="d-flex justify-content-between align-items-start gap-3 flex-column flex-sm-row">
                      <div>
                        <div className="fw-semibold">{plan.name}</div>
                        <small className="text-muted d-block">
                          Starts {formatDate(plan.start_date)} • {plan.schedule_time.slice(0, 5)} •
                          every {plan.every_n_days} day{plan.every_n_days === 1 ? "" : "s"}
                        </small>
                        <small className="d-block mt-1">{plan.instructions}</small>
                      </div>
                      <div className="d-flex gap-2 align-items-center flex-wrap">
                        <span
                          className={`badge align-self-start ${plan.is_active ? "text-bg-success" : "text-bg-secondary"}`}
                        >
                          {plan.is_active ? "Active" : "Inactive"}
                        </span>
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => setEditingPlan(plan)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          disabled={deletingPlanId === plan.id}
                          onClick={() => void onDeletePlan(plan.id)}
                        >
                          {deletingPlanId === plan.id ? "Deleting…" : "Delete"}
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
            <div className="card-header fw-semibold py-2">Dose history</div>
            <ul className="list-group list-group-flush">
              {history.length === 0 ? (
                <li className="list-group-item py-2 text-muted">No recent medication history.</li>
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
      setError("Name and instructions are required.");
      return;
    }
    if (!Number.isInteger(parsedEvery) || parsedEvery < 1) {
      setError("Every N days must be a positive integer.");
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
            <h3 className="modal-title h5">Edit medication plan</h3>
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
                <label className="form-label small fw-semibold mb-1">Start date</label>
                <input
                  className="form-control"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
              <div className="col-sm-6">
                <label className="form-label small fw-semibold mb-1">Schedule time</label>
                <input
                  className="form-control"
                  type="time"
                  value={scheduleTime}
                  onChange={(event) => setScheduleTime(event.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="form-label small fw-semibold mb-1">Every N days</label>
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
              <span className="form-check-label">Active</span>
            </label>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" disabled={isSubmitting} onClick={submit}>
              {isSubmitting ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </div>
  );
}
