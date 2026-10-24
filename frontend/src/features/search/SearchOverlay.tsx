import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import * as m from "@/paraglide/messages";
import { useSearchQuery } from "@/features/search/useSearchQuery";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardFooter, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ListGroupItem } from "@/components/ui/list-group";
import { Spinner } from "@/components/ui/spinner";
import { apiErrorMessage } from "@/lib/api/errorMessages";

const sectionTitleClass =
  "border-b border-border px-4 py-1 text-small font-semibold text-muted-foreground";

/** One result: a title, up to two detail lines and a done/open badge. */
function ResultRow({
  id,
  active,
  title,
  details,
  done,
  doneLabel,
  openLabel,
  onSelect,
  onFocus,
}: {
  id: string;
  active: boolean;
  title: string;
  details: (string | null)[];
  done: boolean;
  doneLabel: string;
  openLabel: string;
  onSelect: () => void;
  onFocus: () => void;
}) {
  const detailClass = active ? "text-white" : "text-muted-foreground";
  const [first, second] = details;
  return (
    <ListGroupItem
      id={id}
      render={<button type="button" />}
      action
      active={active}
      className="rounded-none border-0 px-4 py-2"
      onClick={onSelect}
      onFocus={onFocus}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-semibold">{title}</div>
          {first ? <small className={detailClass}>{first}</small> : null}
          {second ? <small className={`block ${detailClass}`}>{second}</small> : null}
        </div>
        <Badge variant={done ? "success" : "secondary"}>{done ? doneLabel : openLabel}</Badge>
      </div>
    </ListGroupItem>
  );
}

const DEBOUNCE_MS = 300;
const MIN_QUERY_LEN = 2;

export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchQuery = useSearchQuery(debouncedQuery, debouncedQuery.length >= MIN_QUERY_LEN);
  const results =
    query.trim() === debouncedQuery && query.trim().length >= MIN_QUERY_LEN
      ? (searchQuery.data ?? null)
      : null;
  const loading = searchQuery.isFetching;
  const error = searchQuery.error
    ? apiErrorMessage(searchQuery.error, m.api_search_failed())
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

  const onQueryChange = (value: string) => {
    setQuery(value);
    setActiveIndex(-1);
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    const trimmed = value.trim();
    if (trimmed.length < MIN_QUERY_LEN) {
      setDebouncedQuery("");
      return;
    }
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(trimmed);
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

  // Results navigate to routes; they are buttons, not selected combobox values.
  // Move actual focus so assistive technology announces each destination.
  const focusResult = (index: number) => {
    const item = flatItems[index];
    if (item) document.getElementById(item.key)?.focus();
    else if (index < 0) inputRef.current?.focus();
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && flatItems.length > 0) {
      e.preventDefault();
      focusResult(0);
    }
  };

  const onResultsKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      focusResult(
        e.key === "ArrowDown" ? Math.min(activeIndex + 1, flatItems.length - 1) : activeIndex - 1,
      );
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      focusResult(e.key === "Home" ? 0 : flatItems.length - 1);
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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent position="top" initialFocus={inputRef} aria-label={m.app_search()}>
        <CardHeader className="p-2">
          <div className="flex w-full flex-wrap items-stretch">
            <span className="flex items-center px-3 py-1.5 text-center leading-normal whitespace-nowrap">
              <Search className="size-4" aria-hidden="true" />
            </span>
            <Input
              ref={inputRef}
              type="search"
              aria-label={m.app_search()}
              aria-describedby="search-keyboard-hint"
              onFocus={() => setActiveIndex(-1)}
              className="-ms-px min-w-0 flex-1 border-0 shadow-none focus:ring-0"
              placeholder={m.search_placeholder()}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={onInputKeyDown}
              autoComplete="off"
            />
            {loading ? (
              <span className="-ms-px flex items-center px-3 py-1.5 text-center leading-normal whitespace-nowrap">
                <Spinner role="status" />
              </span>
            ) : null}
            <Button
              variant="link"
              className="-ms-px border-0"
              onClick={onClose}
              aria-label={m.ui_close_search()}
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
          {query.length > 0 && query.length < MIN_QUERY_LEN ? (
            <div className="px-2 pb-1">
              <small className="text-muted-foreground">
                {m.search_min_chars({ min: MIN_QUERY_LEN })}
              </small>
            </div>
          ) : null}
        </CardHeader>

        <div className="flex-auto overflow-auto" onKeyDown={onResultsKeyDown} aria-busy={loading}>
          {error ? (
            <Alert variant="danger" className="m-2 py-2" role="alert">
              {error}
            </Alert>
          ) : null}

          {results && totalResults === 0 && !loading ? (
            <div className="p-4 text-center text-muted-foreground" role="status">
              {m.search_no_results({ query: results.query })}
            </div>
          ) : null}

          {results && results.routine_templates.length > 0 ? (
            <div>
              <div className={sectionTitleClass}>{m.search_routine_templates()}</div>
              {results.routine_templates.map((r, i) => (
                <ResultRow
                  key={`routine-${r.id}`}
                  id={`routine-${r.id}`}
                  active={routineOffset + i === activeIndex}
                  onFocus={() => setActiveIndex(routineOffset + i)}
                  title={r.name}
                  details={[r.description]}
                  done={r.is_active}
                  doneLabel={m.status_active()}
                  openLabel={m.status_inactive()}
                  onSelect={() => navigateTo("/templates")}
                />
              ))}
            </div>
          ) : null}

          {results && results.chore_templates.length > 0 ? (
            <div>
              <div className={sectionTitleClass}>{m.search_chore_templates()}</div>
              {results.chore_templates.map((c, i) => (
                <ResultRow
                  key={`chore-${c.id}`}
                  id={`chore-${c.id}`}
                  active={choreOffset + i === activeIndex}
                  onFocus={() => setActiveIndex(choreOffset + i)}
                  title={c.name}
                  details={[c.description]}
                  done={c.is_active}
                  doneLabel={m.status_active()}
                  openLabel={m.status_inactive()}
                  onSelect={() => navigateTo("/templates")}
                />
              ))}
            </div>
          ) : null}

          {results && results.medication_plans.length > 0 ? (
            <div>
              <div className={sectionTitleClass}>{m.search_medications()}</div>
              {results.medication_plans.map((med, i) => (
                <ResultRow
                  key={`med-${med.id}`}
                  id={`med-${med.id}`}
                  active={medOffset + i === activeIndex}
                  onFocus={() => setActiveIndex(medOffset + i)}
                  title={med.name}
                  details={[med.instructions]}
                  done={med.is_active}
                  doneLabel={m.status_active()}
                  openLabel={m.status_inactive()}
                  onSelect={() => navigateTo("/medication")}
                />
              ))}
            </div>
          ) : null}

          {results && results.planned_items.length > 0 ? (
            <div>
              <div className={sectionTitleClass}>{m.search_planned_items()}</div>
              {results.planned_items.map((p, i) => (
                <ResultRow
                  key={`planned-${p.id}`}
                  id={`planned-${p.id}`}
                  active={plannedOffset + i === activeIndex}
                  onFocus={() => setActiveIndex(plannedOffset + i)}
                  title={p.title}
                  details={[p.planned_for, p.notes]}
                  done={p.is_done}
                  doneLabel={m.search_done()}
                  openLabel={m.search_planned()}
                  onSelect={() => navigateTo("/calendar")}
                />
              ))}
            </div>
          ) : null}

          {!results && !loading && !error && query.length >= MIN_QUERY_LEN ? (
            <div className="p-4 text-center text-muted-foreground" role="status">
              {m.search_searching()}
            </div>
          ) : null}
        </div>

        <CardFooter className="px-4 py-1">
          <small id="search-keyboard-hint" className="text-muted-foreground">
            {m.search_keyboard_hint()}
          </small>
        </CardFooter>
      </DialogContent>
    </Dialog>
  );
}
