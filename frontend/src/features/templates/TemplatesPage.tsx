import { useEffect, useState } from 'react';
import {
  createChoreTemplate,
  createRoutineTemplate,
  deleteChoreTemplate,
  deleteRoutineTemplate,
  isRetryableApiError,
  listChoreTemplates,
  listRoutineTemplates,
  updateChoreTemplate,
  updateRoutineTemplate,
  type ChoreTemplate,
  type RoutineTemplate,
} from '../../lib/api/today';
import { formatDate } from '../../lib/dateUtils';

export function TemplatesPage() {
  const [routines, setRoutines] = useState<RoutineTemplate[]>([]);
  const [chores, setChores] = useState<ChoreTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [routineName, setRoutineName] = useState('');
  const [routineDescription, setRoutineDescription] = useState('');
  const [routineStartDate, setRoutineStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [routineEveryNDays, setRoutineEveryNDays] = useState('1');
  const [routineDueTime, setRoutineDueTime] = useState('08:00');
  const [routineActive, setRoutineActive] = useState(true);
  const [editingRoutineId, setEditingRoutineId] = useState<number | null>(null);

  const [choreName, setChoreName] = useState('');
  const [choreDescription, setChoreDescription] = useState('');
  const [choreStartDate, setChoreStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [choreEveryNDays, setChoreEveryNDays] = useState('7');
  const [choreActive, setChoreActive] = useState(true);
  const [editingChoreId, setEditingChoreId] = useState<number | null>(null);

  const loadTemplates = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    setCanRetry(false);
    try {
      const [nextRoutines, nextChores] = await Promise.all([
        listRoutineTemplates(),
        listChoreTemplates(),
      ]);
      if (!signal?.aborted) {
        setRoutines(nextRoutines);
        setChores(nextChores);
      }
    } catch (err) {
      if (!signal?.aborted) {
        setCanRetry(isRetryableApiError(err));
        setError(err instanceof Error ? err.message : 'Unable to load template data.');
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadTemplates(controller.signal);
    return () => controller.abort();
  }, []);

  const resetRoutineForm = () => {
    setEditingRoutineId(null);
    setRoutineName('');
    setRoutineDescription('');
    setRoutineStartDate(new Date().toISOString().slice(0, 10));
    setRoutineEveryNDays('1');
    setRoutineDueTime('08:00');
    setRoutineActive(true);
  };

  const resetChoreForm = () => {
    setEditingChoreId(null);
    setChoreName('');
    setChoreDescription('');
    setChoreStartDate(new Date().toISOString().slice(0, 10));
    setChoreEveryNDays('7');
    setChoreActive(true);
  };

  const submitRoutine = async () => {
    if (!routineName.trim()) {
      setSubmitError('Routine name is required.');
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);
    try {
      const payload = {
        name: routineName.trim(),
        description: routineDescription.trim() || null,
        start_date: routineStartDate,
        every_n_days: Number(routineEveryNDays),
        due_time: routineDueTime ? `${routineDueTime}:00` : null,
        is_active: routineActive,
      };
      if (editingRoutineId) {
        await updateRoutineTemplate(editingRoutineId, payload);
      } else {
        await createRoutineTemplate(payload);
      }
      resetRoutineForm();
      setSuccessMessage(editingRoutineId ? 'Routine template updated.' : 'Routine template created.');
      await loadTemplates();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save routine template.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitChore = async () => {
    if (!choreName.trim()) {
      setSubmitError('Chore name is required.');
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);
    try {
      const payload = {
        name: choreName.trim(),
        description: choreDescription.trim() || null,
        start_date: choreStartDate,
        every_n_days: Number(choreEveryNDays),
        is_active: choreActive,
      };
      if (editingChoreId) {
        await updateChoreTemplate(editingChoreId, payload);
      } else {
        await createChoreTemplate(payload);
      }
      resetChoreForm();
      setSuccessMessage(editingChoreId ? 'Chore template updated.' : 'Chore template created.');
      await loadTemplates();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save chore template.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 mb-2">
        <h2 className="h4 mb-0">Templates</h2>
        <button type="button" className="btn btn-outline-primary btn-sm" disabled={loading} onClick={() => void loadTemplates()}>
          Refresh
        </button>
      </div>
      <p className="text-muted mb-3">Manage reusable routine and chore templates. Both template types now generate scheduled work from their recurrence settings.</p>

      {loading ? <div className="alert alert-info py-2">Loading templates...</div> : null}
      {error ? (
        <div className="alert alert-danger py-2 d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <span>{error}</span>
          {canRetry ? (
            <button type="button" className="btn btn-danger btn-sm" onClick={() => void loadTemplates()}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
      {submitError ? <div className="alert alert-danger py-2">{submitError}</div> : null}
      {successMessage ? <div className="alert alert-success py-2">{successMessage}</div> : null}

      <div className="row g-3">
        <div className="col-xl-6">
          <div className="card mb-3">
            <div className="card-header fw-semibold py-2">Routine template</div>
            <div className="card-body d-grid gap-2">
              <input className="form-control" value={routineName} onChange={(event) => setRoutineName(event.target.value)} placeholder="Routine name" />
              <textarea className="form-control" rows={3} value={routineDescription} onChange={(event) => setRoutineDescription(event.target.value)} placeholder="Description" />
              <div className="row g-2">
                <div className="col-sm-6">
                  <label className="form-label small fw-semibold mb-1">Start date</label>
                  <input className="form-control" type="date" value={routineStartDate} onChange={(event) => setRoutineStartDate(event.target.value)} />
                </div>
                <div className="col-sm-6">
                  <label className="form-label small fw-semibold mb-1">Every N days</label>
                  <input className="form-control" type="number" min={1} value={routineEveryNDays} onChange={(event) => setRoutineEveryNDays(event.target.value)} />
                </div>
              </div>
              <div>
                <label className="form-label small fw-semibold mb-1">Due time</label>
                <input className="form-control" type="time" value={routineDueTime} onChange={(event) => setRoutineDueTime(event.target.value)} />
              </div>
              <label className="form-check">
                <input className="form-check-input" type="checkbox" checked={routineActive} onChange={(event) => setRoutineActive(event.target.checked)} />
                <span className="form-check-label">Active</span>
              </label>
              <div className="d-flex gap-2 flex-column flex-sm-row">
                <button type="button" className="btn btn-primary" disabled={isSubmitting} onClick={() => void submitRoutine()}>
                  {isSubmitting ? (editingRoutineId ? 'Saving…' : 'Creating…') : editingRoutineId ? 'Save routine' : 'Create routine'}
                </button>
                {editingRoutineId ? (
                  <button type="button" className="btn btn-outline-secondary" disabled={isSubmitting} onClick={resetRoutineForm}>
                    Cancel edit
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header fw-semibold py-2">Routine templates</div>
            <ul className="list-group list-group-flush">
              {routines.length === 0 ? (
                <li className="list-group-item py-2 text-muted">No routine templates yet.</li>
              ) : (
                routines.map((routine) => (
                  <li key={routine.id} className="list-group-item py-2">
                    <div className="d-flex justify-content-between align-items-start gap-3">
                      <div>
                        <div className="fw-semibold">{routine.name}</div>
                        {routine.description ? <small className="d-block">{routine.description}</small> : null}
                        <small className="text-muted d-block">
                          Starts {formatDate(routine.start_date)} • every {routine.every_n_days} day{routine.every_n_days === 1 ? '' : 's'}{routine.due_time ? ` • ${routine.due_time.slice(0, 5)}` : ''}
                        </small>
                        <small className="text-muted d-block">Created {formatDate(routine.created_at)}</small>
                      </div>
                      <div className="d-grid gap-2">
                        <span className={`badge ${routine.is_active ? 'text-bg-success' : 'text-bg-secondary'}`}>{routine.is_active ? 'Active' : 'Inactive'}</span>
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => {
                            setEditingRoutineId(routine.id);
                            setRoutineName(routine.name);
                            setRoutineDescription(routine.description ?? '');
                            setRoutineStartDate(routine.start_date);
                            setRoutineEveryNDays(String(routine.every_n_days));
                            setRoutineDueTime(routine.due_time ? routine.due_time.slice(0, 5) : '');
                            setRoutineActive(routine.is_active);
                            setSubmitError(null);
                          }}
                        >
                          Edit
                        </button>
                        <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => void (async () => {
                          if (!window.confirm('Delete this routine template?')) {
                            return;
                          }
                          setIsSubmitting(true);
                          setSubmitError(null);
                          setSuccessMessage(null);
                          try {
                            await deleteRoutineTemplate(routine.id);
                            if (editingRoutineId === routine.id) resetRoutineForm();
                            setSuccessMessage('Routine template deleted.');
                            await loadTemplates();
                          } catch (err) {
                            setSubmitError(err instanceof Error ? err.message : 'Failed to delete routine template.');
                          } finally {
                            setIsSubmitting(false);
                          }
                        })()}>
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        <div className="col-xl-6">
          <div className="card mb-3">
            <div className="card-header fw-semibold py-2">Chore template</div>
            <div className="card-body d-grid gap-2">
              <input className="form-control" value={choreName} onChange={(event) => setChoreName(event.target.value)} placeholder="Chore name" />
              <textarea className="form-control" rows={3} value={choreDescription} onChange={(event) => setChoreDescription(event.target.value)} placeholder="Description" />
              <div className="row g-2">
                <div className="col-sm-6">
                  <label className="form-label small fw-semibold mb-1">Start date</label>
                  <input className="form-control" type="date" value={choreStartDate} onChange={(event) => setChoreStartDate(event.target.value)} />
                </div>
                <div className="col-sm-6">
                  <label className="form-label small fw-semibold mb-1">Every N days</label>
                  <input className="form-control" type="number" min={1} value={choreEveryNDays} onChange={(event) => setChoreEveryNDays(event.target.value)} />
                </div>
              </div>
              <label className="form-check">
                <input className="form-check-input" type="checkbox" checked={choreActive} onChange={(event) => setChoreActive(event.target.checked)} />
                <span className="form-check-label">Active</span>
              </label>
              <div className="d-flex gap-2 flex-column flex-sm-row">
                <button type="button" className="btn btn-primary" disabled={isSubmitting} onClick={() => void submitChore()}>
                  {isSubmitting ? (editingChoreId ? 'Saving…' : 'Creating…') : editingChoreId ? 'Save chore' : 'Create chore'}
                </button>
                {editingChoreId ? (
                  <button type="button" className="btn btn-outline-secondary" disabled={isSubmitting} onClick={resetChoreForm}>
                    Cancel edit
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header fw-semibold py-2">Chore templates</div>
            <ul className="list-group list-group-flush">
              {chores.length === 0 ? (
                <li className="list-group-item py-2 text-muted">No chore templates yet.</li>
              ) : (
                chores.map((chore) => (
                  <li key={chore.id} className="list-group-item py-2">
                    <div className="d-flex justify-content-between align-items-start gap-3">
                      <div>
                        <div className="fw-semibold">{chore.name}</div>
                        {chore.description ? <small className="d-block">{chore.description}</small> : null}
                        <small className="text-muted d-block">
                          Starts {formatDate(chore.start_date)} • every {chore.every_n_days} day{chore.every_n_days === 1 ? '' : 's'}
                        </small>
                      </div>
                      <div className="d-grid gap-2">
                        <span className={`badge ${chore.is_active ? 'text-bg-success' : 'text-bg-secondary'}`}>{chore.is_active ? 'Active' : 'Inactive'}</span>
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => {
                            setEditingChoreId(chore.id);
                            setChoreName(chore.name);
                            setChoreDescription(chore.description ?? '');
                            setChoreStartDate(chore.start_date);
                            setChoreEveryNDays(String(chore.every_n_days));
                            setChoreActive(chore.is_active);
                            setSubmitError(null);
                          }}
                        >
                          Edit
                        </button>
                        <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => void (async () => {
                          if (!window.confirm('Delete this chore template?')) {
                            return;
                          }
                          setIsSubmitting(true);
                          setSubmitError(null);
                          setSuccessMessage(null);
                          try {
                            await deleteChoreTemplate(chore.id);
                            if (editingChoreId === chore.id) resetChoreForm();
                            setSuccessMessage('Chore template deleted.');
                            await loadTemplates();
                          } catch (err) {
                            setSubmitError(err instanceof Error ? err.message : 'Failed to delete chore template.');
                          } finally {
                            setIsSubmitting(false);
                          }
                        })()}>
                          Delete
                        </button>
                      </div>
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
