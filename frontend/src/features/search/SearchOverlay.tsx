import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import * as m from "@/paraglide/messages";
import { useSearchQuery } from "@/features/search/useSearchQuery";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LEN = 2;

export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchQuery = useSearchQuery(
    debouncedQuery,
    debouncedQuery.length >= MIN_QUERY_LEN,
  );
  const results = searchQuery.data ?? null;
  const loading = searchQuery.isFetching;
  const error = searchQuery.error instanceof Error
    ? searchQuery.error.message
    : searchQuery.error
      ? "Search failed."
      : null;

  const flatItems = useMemo(() => {
    if (!results) return [];
    return [
      ...results.routine_templates.map((r) => ({ key: `routine-${r.id}`, path: "/templates" })),
      ...results.chore_templates.map((c) => ({ key: `chore-${c.id}`, path: "/templates" })),
      ...results.medication_plans.map((med) => ({ key: `med-${med.id}`, path: "/medication" })),
      ...results.planned_items.map((p) => ({ key: `planned-${p.id}`, path: "/calendar" })),
    ];
  }, [results]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [results]);

  useEffect(() => {
    if (activeIndex >= 0) {
      const key = flatItems[activeIndex]?.key;
      if (key) document.getElementById(key)?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, flatItems]);

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

  const onQueryChange = (value: string) => {
    setQuery(value);
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    if (value.length < MIN_QUERY_LEN) {
      setDebouncedQuery("");
      return;
    }
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(value);
    }, DEBOUNCE_MS);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const navigateTo = (path: string) => {
    onClose();
    void navigate({ to: path });
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      const item = flatItems[activeIndex];
      if (item) navigateTo(item.path);
    }
  };

  const totalResults = results
    ? results.routine_templates.length +
      results.chore_templates.length +
      results.medication_plans.length +
      results.planned_items.length
    : 0;

  const routineOffset = 0;
  const choreOffset = routineOffset + (results?.routine_templates.length ?? 0);
  const medOffset = choreOffset + (results?.chore_templates.length ?? 0);
  const plannedOffset = medOffset + (results?.medication_plans.length ?? 0);

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
              placeholder={m.search_placeholder()}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={onInputKeyDown}
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
              <small className="text-muted">{m.search_min_chars({ min: MIN_QUERY_LEN })}</small>
            </div>
          ) : null}
        </div>

        <div className="overflow-auto flex-fill">
          {error ? (
            <div className="alert alert-danger m-2 py-2">{error}</div>
          ) : null}

          {results && totalResults === 0 && !loading ? (
            <div className="p-3 text-muted text-center">{m.search_no_results({ query: results.query })}</div>
          ) : null}

          {results && results.routine_templates.length > 0 ? (
            <div>
              <div className="px-3 py-1 small fw-semibold text-muted border-bottom">{m.search_routine_templates()}</div>
              {results.routine_templates.map((r, i) => (
                <button
                  key={`routine-${r.id}`}
                  id={`routine-${r.id}`}
                  type="button"
                  className={`list-group-item list-group-item-action border-0 px-3 py-2${routineOffset + i === activeIndex ? " active" : ""}`}
                  onClick={() => navigateTo("/templates")}
                >
                  <div className="d-flex justify-content-between align-items-center gap-2">
                    <div>
                      <div className="fw-semibold">{r.name}</div>
                      {r.description ? <small className="text-muted">{r.description}</small> : null}
                    </div>
                    <span className={`badge ${r.is_active ? "text-bg-success" : "text-bg-secondary"}`}>
                      {r.is_active ? m.status_active() : m.status_inactive()}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {results && results.chore_templates.length > 0 ? (
            <div>
              <div className="px-3 py-1 small fw-semibold text-muted border-bottom">{m.search_chore_templates()}</div>
              {results.chore_templates.map((c, i) => (
                <button
                  key={`chore-${c.id}`}
                  id={`chore-${c.id}`}
                  type="button"
                  className={`list-group-item list-group-item-action border-0 px-3 py-2${choreOffset + i === activeIndex ? " active" : ""}`}
                  onClick={() => navigateTo("/templates")}
                >
                  <div className="d-flex justify-content-between align-items-center gap-2">
                    <div>
                      <div className="fw-semibold">{c.name}</div>
                      {c.description ? <small className="text-muted">{c.description}</small> : null}
                    </div>
                    <span className={`badge ${c.is_active ? "text-bg-success" : "text-bg-secondary"}`}>
                      {c.is_active ? m.status_active() : m.status_inactive()}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {results && results.medication_plans.length > 0 ? (
            <div>
              <div className="px-3 py-1 small fw-semibold text-muted border-bottom">{m.search_medications()}</div>
              {results.medication_plans.map((med, i) => (
                <button
                  key={`med-${med.id}`}
                  id={`med-${med.id}`}
                  type="button"
                  className={`list-group-item list-group-item-action border-0 px-3 py-2${medOffset + i === activeIndex ? " active" : ""}`}
                  onClick={() => navigateTo("/medication")}
                >
                  <div className="d-flex justify-content-between align-items-center gap-2">
                    <div>
                      <div className="fw-semibold">{med.name}</div>
                      {med.instructions ? <small className="text-muted">{med.instructions}</small> : null}
                    </div>
                    <span className={`badge ${med.is_active ? "text-bg-success" : "text-bg-secondary"}`}>
                      {med.is_active ? m.status_active() : m.status_inactive()}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {results && results.planned_items.length > 0 ? (
            <div>
              <div className="px-3 py-1 small fw-semibold text-muted border-bottom">{m.search_planned_items()}</div>
              {results.planned_items.map((p, i) => (
                <button
                  key={`planned-${p.id}`}
                  id={`planned-${p.id}`}
                  type="button"
                  className={`list-group-item list-group-item-action border-0 px-3 py-2${plannedOffset + i === activeIndex ? " active" : ""}`}
                  onClick={() => navigateTo(`/calendar`)}
                >
                  <div className="d-flex justify-content-between align-items-center gap-2">
                    <div>
                      <div className="fw-semibold">{p.title}</div>
                      <small className="text-muted">{p.planned_for}</small>
                      {p.notes ? <small className="text-muted d-block">{p.notes}</small> : null}
                    </div>
                    <span className={`badge ${p.is_done ? "text-bg-success" : "text-bg-secondary"}`}>
                      {p.is_done ? m.search_done() : m.search_planned()}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {!results && !loading && !error && query.length >= MIN_QUERY_LEN ? (
            <div className="p-3 text-muted text-center">{m.search_searching()}</div>
          ) : null}
        </div>

        <div className="card-footer py-1 px-3">
          <small className="text-muted">{m.search_keyboard_hint()}</small>
        </div>
      </div>
    </div>
  );
}
