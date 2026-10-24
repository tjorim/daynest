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
  "tw:border-b tw:border-border tw:px-4 tw:py-1 tw:text-small tw:font-semibold tw:text-muted-foreground";

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
}: {
  id: string;
  active: boolean;
  title: string;
  details: (string | null)[];
  done: boolean;
  doneLabel: string;
  openLabel: string;
  onSelect: () => void;
}) {
  const detailClass = active ? "tw:text-white/75" : "tw:text-muted-foreground";
  const [first, second] = details;
  return (
    <ListGroupItem
      id={id}
      render={<button type="button" />}
      action
      active={active}
      className="tw:rounded-none tw:border-0 tw:px-4 tw:py-2"
      onClick={onSelect}
    >
      <div className="tw:flex tw:items-center tw:justify-between tw:gap-2">
        <div>
          <div className="tw:font-semibold">{title}</div>
          {first ? <small className={detailClass}>{first}</small> : null}
          {second ? <small className={`tw:block ${detailClass}`}>{second}</small> : null}
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
  const results = searchQuery.data ?? null;
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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent position="top" initialFocus={inputRef} aria-label={m.app_search()}>
        <CardHeader className="tw:p-2">
          <div className="tw:flex tw:w-full tw:flex-wrap tw:items-stretch">
            <span className="tw:flex tw:items-center tw:px-3 tw:py-1.5 tw:text-center tw:leading-normal tw:whitespace-nowrap">
              <i className="bi bi-search" aria-hidden="true" />
            </span>
            <Input
              ref={inputRef}
              type="search"
              className="tw:-ms-px tw:min-w-0 tw:flex-1 tw:border-0 tw:shadow-none tw:focus:ring-0"
              placeholder={m.search_placeholder()}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={onInputKeyDown}
              autoComplete="off"
            />
            {loading ? (
              <span className="tw:-ms-px tw:flex tw:items-center tw:px-3 tw:py-1.5 tw:text-center tw:leading-normal tw:whitespace-nowrap">
                <Spinner role="status" />
              </span>
            ) : null}
            <Button
              variant="link"
              className="tw:-ms-px tw:border-0"
              onClick={onClose}
              aria-label={m.ui_close_search()}
            >
              <i className="bi bi-x-lg" aria-hidden="true" />
            </Button>
          </div>
          {query.length > 0 && query.length < MIN_QUERY_LEN ? (
            <div className="tw:px-2 tw:pb-1">
              <small className="tw:text-muted-foreground">
                {m.search_min_chars({ min: MIN_QUERY_LEN })}
              </small>
            </div>
          ) : null}
        </CardHeader>

        <div className="tw:flex-auto tw:overflow-auto">
          {error ? (
            <Alert variant="danger" className="tw:m-2 tw:py-2">
              {error}
            </Alert>
          ) : null}

          {results && totalResults === 0 && !loading ? (
            <div className="tw:p-4 tw:text-center tw:text-muted-foreground">
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
            <div className="tw:p-4 tw:text-center tw:text-muted-foreground">
              {m.search_searching()}
            </div>
          ) : null}
        </div>

        <CardFooter className="tw:px-4 tw:py-1">
          <small className="tw:text-muted-foreground">{m.search_keyboard_hint()}</small>
        </CardFooter>
      </DialogContent>
    </Dialog>
  );
}
