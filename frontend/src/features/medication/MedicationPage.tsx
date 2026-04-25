import { useEffect, useState } from 'react';
import {
  createMedicationPlan,
  fetchMedicationHistory,
  isRetryableApiError,
  listMedicationPlans,
  type MedicationHistoryItem,
  type MedicationPlan,
} from '../../lib/api/today';
import { formatDate, formatDateTime } from '../../lib/dateUtils';

export function MedicationPage() {
  const [plans, setPlans] = useState<MedicationPlan[]>([]);
  const [history, setHistory] = useState<MedicationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [scheduleTime, setScheduleTime] = useState('09:00:00');
  const [everyNDays, setEveryNDays] = useState('1');

  const loadMedication = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    setCanRetry(false);
    try {
      const [nextPlans, nextHistory] = await Promise.all([
        listMedicationPlans(),
        fetchMedicationHistory(),
      ]);
      if (!signal?.aborted) {
        setPlans(nextPlans);
        setHistory(nextHistory);
      }
    } catch (err) {
      if (!signal?.aborted) {
        setCanRetry(isRetryableApiError(err));
        setError(err instanceof Error ? err.message : 'Unable to load medication data.');
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
      setSubmitError('Name and instructions are required.');
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
        every_n_days: Number(everyNDays),
      });
      setName('');
      setInstructions('');
      setStartDate(new Date().toISOString().slice(0, 10));
      setScheduleTime('09:00:00');
      setEveryNDays('1');
      setSuccessMessage('Medication plan created.');
      await loadMedication();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create medication plan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 mb-2">
        <h2 className="h4 mb-0">Medication</h2>
        <button type="button" className="btn btn-outline-primary btn-sm" disabled={loading} onClick={() => void loadMedication()}>
          Refresh
        </button>
      </div>
      <p className="text-muted mb-3">Manage recurring medication plans and review recent dose history outside the Today workflow.</p>

      {loading ? <div className="alert alert-info py-2">Loading medication...</div> : null}
      {error ? (
        <div className="alert alert-danger py-2 d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <span>{error}</span>
          {canRetry ? (
            <button type="button" className="btn btn-danger btn-sm" onClick={() => void loadMedication()}>
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
                }}
                placeholder="Instructions"
              />
              <div className="row g-2">
                <div className="col-sm-6">
                  <label className="form-label small fw-semibold mb-1">Start date</label>
                  <input className="form-control" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                </div>
                <div className="col-sm-6">
                  <label className="form-label small fw-semibold mb-1">Schedule time</label>
                  <input className="form-control" type="time" value={scheduleTime.slice(0, 5)} onChange={(event) => setScheduleTime(event.target.value)} />
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
                  }}
                />
              </div>
              <button type="button" className="btn btn-primary" disabled={isSubmitting} onClick={() => void onCreatePlan()}>
                {isSubmitting ? 'Creating…' : 'Create plan'}
              </button>
            </div>
            {submitError ? <div className="card-footer text-danger py-2 small">{submitError}</div> : null}
          </div>

          <div className="card">
            <div className="card-header fw-semibold py-2">Active plans</div>
            <ul className="list-group list-group-flush">
              {plans.length === 0 ? (
                <li className="list-group-item py-2 text-muted">No medication plans yet.</li>
              ) : (
                plans.map((plan) => (
                  <li key={plan.id} className="list-group-item py-2">
                    <div className="fw-semibold">{plan.name}</div>
                    <small className="text-muted d-block">
                      Starts {formatDate(plan.start_date)} • {plan.schedule_time.slice(0, 5)} • every {plan.every_n_days} day{plan.every_n_days === 1 ? '' : 's'}
                    </small>
                    <small className="d-block mt-1">{plan.instructions}</small>
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
                      <span className={`badge ${item.status === 'taken' ? 'text-bg-success' : item.status === 'scheduled' ? 'text-bg-info' : 'text-bg-secondary'}`}>
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
    </section>
  );
}
