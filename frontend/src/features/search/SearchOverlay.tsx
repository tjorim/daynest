import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  searchItems,
  type SearchResponse,
} from "@/lib/api/today";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LEN = 2;

export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const doSearch = useCallback(async (q: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const data = await searchItems(q, controller.signal);
      if (!controller.signal.aborted) {
        setResults(data);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : "Search failed.");
        setResults(null);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  const onQueryChange = (value: string) => {
    setQuery(value);
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    if (value.length < MIN_QUERY_LEN) {
      setResults(null);
      setError(null);
      setLoading(false);
      return;
    }
    timerRef.current = setTimeout(() => {
      void doSearch(value);
    }, DEBOUNCE_MS);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const navigateTo = (path: string) => {
    onClose();
    navigate(path);
  };

  const totalResults = results
    ? results.routine_templates.length +
      results.chore_templates.length +
      results.medication_plans.length +
      results.planned_items.length
    : 0;

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-start justify-content-center"
      style={{ zIndex: 1050, background: "rgba(0,0,0,0.5)", paddingTop: "10vh" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card shadow-lg"
        style={{ width: "min(640px, 96vw)", maxHeight: "70vh", display: "flex", flexDirection: "column" }}
      >
        <div className="card-header p-2">
          <div className="input-group">
            <span className="input-group-text border-0 bg-transparent">🔍</span>
            <input
              ref={inputRef}
              type="search"
              className="form-control border-0 shadow-none"
              placeholder="Search routines, chores, medications, plans…"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              autoComplete="off"
            />
            {loading ? (
              <span className="input-group-text border-0 bg-transparent">
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
              </span>
            ) : null}
            <button type="button" className="btn btn-link border-0" onClick={onClose} aria-label="Close search">
              ✕
            </button>
          </div>
          {query.length > 0 && query.length < MIN_QUERY_LEN ? (
            <div className="px-2 pb-1">
              <small className="text-muted">Type at least {MIN_QUERY_LEN} characters to search.</small>
            </div>
          ) : null}
        </div>

        <div className="overflow-auto flex-fill">
          {error ? (
            <div className="alert alert-danger m-2 py-2">{error}</div>
          ) : null}

          {results && totalResults === 0 && !loading ? (
            <div className="p-3 text-muted text-center">No results for "{results.query}".</div>
          ) : null}

          {results && results.routine_templates.length > 0 ? (
            <div>
              <div className="px-3 py-1 small fw-semibold text-muted border-bottom">Routine templates</div>
              {results.routine_templates.map((r) => (
                <button
                  key={`routine-${r.id}`}
                  type="button"
                  className="list-group-item list-group-item-action border-0 px-3 py-2"
                  onClick={() => navigateTo("/templates")}
                >
                  <div className="d-flex justify-content-between align-items-center gap-2">
                    <div>
                      <div className="fw-semibold">{r.name}</div>
                      {r.description ? <small className="text-muted">{r.description}</small> : null}
                    </div>
                    <span className={`badge ${r.is_active ? "text-bg-success" : "text-bg-secondary"}`}>
                      {r.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {results && results.chore_templates.length > 0 ? (
            <div>
              <div className="px-3 py-1 small fw-semibold text-muted border-bottom">Chore templates</div>
              {results.chore_templates.map((c) => (
                <button
                  key={`chore-${c.id}`}
                  type="button"
                  className="list-group-item list-group-item-action border-0 px-3 py-2"
                  onClick={() => navigateTo("/templates")}
                >
                  <div className="d-flex justify-content-between align-items-center gap-2">
                    <div>
                      <div className="fw-semibold">{c.name}</div>
                      {c.description ? <small className="text-muted">{c.description}</small> : null}
                    </div>
                    <span className={`badge ${c.is_active ? "text-bg-success" : "text-bg-secondary"}`}>
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {results && results.medication_plans.length > 0 ? (
            <div>
              <div className="px-3 py-1 small fw-semibold text-muted border-bottom">Medications</div>
              {results.medication_plans.map((m) => (
                <button
                  key={`med-${m.id}`}
                  type="button"
                  className="list-group-item list-group-item-action border-0 px-3 py-2"
                  onClick={() => navigateTo("/medication")}
                >
                  <div className="d-flex justify-content-between align-items-center gap-2">
                    <div>
                      <div className="fw-semibold">{m.name}</div>
                      {m.instructions ? <small className="text-muted">{m.instructions}</small> : null}
                    </div>
                    <span className={`badge ${m.is_active ? "text-bg-success" : "text-bg-secondary"}`}>
                      {m.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {results && results.planned_items.length > 0 ? (
            <div>
              <div className="px-3 py-1 small fw-semibold text-muted border-bottom">Planned items</div>
              {results.planned_items.map((p) => (
                <button
                  key={`planned-${p.id}`}
                  type="button"
                  className="list-group-item list-group-item-action border-0 px-3 py-2"
                  onClick={() => navigateTo(`/calendar`)}
                >
                  <div className="d-flex justify-content-between align-items-center gap-2">
                    <div>
                      <div className="fw-semibold">{p.title}</div>
                      <small className="text-muted">{p.planned_for}</small>
                      {p.notes ? <small className="text-muted d-block">{p.notes}</small> : null}
                    </div>
                    <span className={`badge ${p.is_done ? "text-bg-success" : "text-bg-secondary"}`}>
                      {p.is_done ? "Done" : "Planned"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {!results && !loading && !error && query.length >= MIN_QUERY_LEN ? (
            <div className="p-3 text-muted text-center">Searching…</div>
          ) : null}
        </div>

        <div className="card-footer py-1 px-3">
          <small className="text-muted">Press Esc to close · Enter at least 2 characters to search</small>
        </div>
      </div>
    </div>
  );
}
