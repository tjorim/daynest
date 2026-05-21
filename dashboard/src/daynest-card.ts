import { LitElement, PropertyValues, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { HomeAssistant } from "custom-card-helpers";
import { DaynestCardConfig, sensorNum, sensorStr } from "./types";
import { cardStyles } from "./styles";

interface TodoItem {
  uid: string;
  summary: string;
  status: "needs_action" | "completed";
  description?: string;
}

interface DailyCount {
  date: string;
  completed: number;
  total: number;
}

interface DailyAdherence {
  date: string;
  taken: number;
  total: number;
}

interface WeekSummaryResponse {
  chores?: { daily_completions?: DailyCount[] };
  planned_items?: { daily_completions?: DailyCount[] };
  routines?: { daily_completions?: DailyCount[] };
  medications?: { daily_adherence?: DailyAdherence[] };
}

interface WeekDaySummary {
  date: string;
  completed: number;
  total: number;
}

type CardGridOptions = {
  columns: number;
  rows: number;
  min_columns: number;
  min_rows: number;
};

const DEFAULT_SENSOR_PREFIX = "sensor.daynest_";

const serviceMap = {
  due: {
    done: { service: "complete_task", dataKey: "chore_instance_id" },
    skip: { service: "skip_task", dataKey: "chore_instance_id" },
  },
  overdue: {
    done: { service: "complete_task", dataKey: "chore_instance_id" },
    skip: { service: "skip_task", dataKey: "chore_instance_id" },
  },
  routine: {
    done: { service: "complete_task", dataKey: "chore_instance_id" },
    skip: { service: "skip_task", dataKey: "chore_instance_id" },
  },
  medication: {
    done: { service: "mark_medication_taken", dataKey: "medication_dose_id" },
    skip: { service: "skip_medication", dataKey: "medication_dose_id" },
  },
  planned: {
    done: { service: "mark_planned_done", dataKey: "id" },
  },
} as const;

type ServicePrefix = keyof typeof serviceMap;
type SkippablePrefix = Exclude<ServicePrefix, "planned">;

function isServicePrefix(prefix: string): prefix is ServicePrefix {
  return prefix in serviceMap;
}

function parseUid(uid: string): { prefix: ServicePrefix; id: number } | null {
  const parts = uid.split(":");
  if (parts.length !== 2) return null;

  const [prefix, rawId] = parts;
  const id = Number(rawId);
  if (!isServicePrefix(prefix) || rawId.trim() === "" || !Number.isInteger(id)) {
    return null;
  }

  return { prefix, id };
}

function isSnoozablePrefix(prefix: string): boolean {
  return prefix === "due" || prefix === "overdue";
}

function isSkippablePrefix(prefix: string): prefix is SkippablePrefix {
  return isServicePrefix(prefix) && prefix !== "planned";
}

const metricSensorDefinitions = [
  { suffix: "due_today_count", label: "Due today" },
  { suffix: "overdue_count", label: "Overdue" },
  { suffix: "planned_count", label: "Planned" },
  { suffix: "medication_due_count", label: "Medication due" },
  { suffix: "completion_ratio", label: "Completion" },
  { suffix: "next_medication", label: "Next medication" },
  { suffix: "routines_open_count", label: "Routines open" },
  { suffix: "planned_remaining_count", label: "Planned left" },
] as const;

type MetricSensorSuffix = (typeof metricSensorDefinitions)[number]["suffix"];

type WindowWithCustomCards = Window & {
  customCards?: Array<{
    type: string;
    name: string;
    description: string;
    preview: boolean;
    documentationURL?: string;
  }>;
};

@customElement("daynest-card")
class DaynestCard extends LitElement {
  static styles = cardStyles;

  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config!: DaynestCardConfig;
  @state() private _items: TodoItem[] = [];
  @state() private _week: WeekDaySummary[] = [];
  @state() private _quickAddOpen = false;
  @state() private _quickAddTitle = "";
  @state() private _quickAddPlannedFor = "";
  @state() private _quickAddPending = false;

  connectedCallback() {
    super.connectedCallback();
    void this._fetchItems();
    void this._fetchWeek();
  }

  static getConfigForm() {
    return {
      schema: [
        {
          name: "name",
          label: "Card name",
          selector: { text: {} },
          default: "Today",
        },
        {
          name: "sensor_prefix",
          label: "Sensor prefix",
          selector: { text: {} },
          default: DEFAULT_SENSOR_PREFIX,
        },
        {
          name: "todo_entity",
          label: "Todo entity",
          selector: { entity: { domain: "todo" } },
          default: "todo.daynest_today",
        },
        {
          name: "view",
          label: "View",
          selector: {
            select: {
              options: [
                { label: "Full", value: "full" },
                { label: "Compact", value: "compact" },
                { label: "Week", value: "week" },
              ],
            },
          },
          default: "full",
        },
        {
          name: "show_quick_add",
          label: "Show quick add",
          selector: { boolean: {} },
          default: true,
        },
        {
          name: "snooze_days",
          label: "Snooze days override",
          selector: { number: { min: 1, max: 14, mode: "box" } },
        },
      ],
    };
  }

  static getStubConfig(): DaynestCardConfig {
    return {
      type: "custom:daynest-card",
      sensor_prefix: DEFAULT_SENSOR_PREFIX,
      todo_entity: "todo.daynest_today",
      view: "full",
      show_quick_add: true,
    };
  }

  setConfig(config: DaynestCardConfig) {
    if (!config) throw new Error("Invalid configuration");
    this._config = config;
    void this._fetchItems();
    void this._fetchWeek();
  }

  getCardSize(): number {
    return 4;
  }

  getGridOptions(): CardGridOptions {
    return { columns: 12, rows: 4, min_columns: 6, min_rows: 3 };
  }

  protected updated(changedProps: PropertyValues<this>) {
    if (!changedProps.has("hass")) return;
    const todoEntity = this._config?.todo_entity ?? "todo.daynest_today";
    const prevHass = changedProps.get("hass") as HomeAssistant | undefined;
    const prevLastChanged = prevHass?.states[todoEntity]?.last_updated;
    const currLastChanged = this.hass?.states[todoEntity]?.last_updated;
    if (prevLastChanged !== currLastChanged) {
      void this._fetchItems();
    }
  }

  render() {
    if (!this.hass || !this._config) return html``;

    const prefix = this._config.sensor_prefix ?? DEFAULT_SENSOR_PREFIX;
    const metricValue = (suffix: MetricSensorSuffix) => sensorNum(this.hass, prefix + suffix);
    const pct = Math.max(0, Math.min(100, Math.round(metricValue("completion_ratio"))));
    const view = this._config.view ?? "full";

    const nextMed = sensorStr(this.hass, prefix + "next_medication");
    const showMed = nextMed && nextMed !== "unavailable" && nextMed !== "unknown";

    return html`
      <ha-card>
        <div class="card-header">
          <span>${this._config.name ?? "Today"}</span>
          <ha-icon-button icon="mdi:refresh" @click=${this._refresh}></ha-icon-button>
        </div>
        <div class="ratio-bar"><div class="ratio-fill" style=${`width:${pct}%`}></div></div>
        <div class="metrics-bar">
          ${metricSensorDefinitions
            .filter(
              (metric) =>
                metric.suffix !== "completion_ratio" && metric.suffix !== "next_medication",
            )
            .map((metric) => this._metricTile(metricValue(metric.suffix), metric.label))}
        </div>
        ${showMed ? html`<div class="med-chip">💊 Next: ${nextMed}</div>` : ""}
        ${view === "week"
          ? this._renderWeekView()
          : html`
              ${view !== "compact"
                ? html`
                    <div class="task-list">
                      ${this._renderTaskGroup(
                        "Overdue",
                        this._items.filter((item) => item.uid.startsWith("overdue:")),
                      )}
                      ${this._renderTaskGroup(
                        "Today",
                        this._items.filter(
                          (item) =>
                            item.uid.startsWith("due:") ||
                            item.uid.startsWith("routine:") ||
                            item.uid.startsWith("medication:"),
                        ),
                      )}
                      ${this._renderTaskGroup(
                        "Planned",
                        this._items.filter((item) => item.uid.startsWith("planned:")),
                      )}
                    </div>
                  `
                : ""}
            `}
        ${this._config.show_quick_add ? this._renderQuickAdd() : ""}
      </ha-card>
    `;
  }

  private _metricTile(value: number, label: string) {
    return html`
      <div class="metric-tile">
        <span class="metric-value">${value}</span>
        <span class="metric-label">${label}</span>
      </div>
    `;
  }

  private _renderTaskGroup(label: string, items: TodoItem[]) {
    if (items.length === 0) return html``;
    return html`
      <div class="task-group">
        <div class="task-group-header">${label}</div>
        ${items.map((item) => this._renderTaskItem(item))}
      </div>
    `;
  }

  private _renderTaskItem(item: TodoItem) {
    const parsedUid = parseUid(item.uid);
    const canSkip = parsedUid !== null && isSkippablePrefix(parsedUid.prefix);
    const canSnooze = parsedUid !== null && isSnoozablePrefix(parsedUid.prefix);
    const isDone = item.status === "completed";
    const statusClass = isDone
      ? "done"
      : item.uid.startsWith("overdue:")
        ? "overdue"
        : item.summary.toLowerCase().includes("skip")
          ? "skipped"
          : "pending";
    return html`
      <div class=${`task-item ${statusClass}`}>
        <span>${item.summary}</span>
        ${isDone || parsedUid === null
          ? html``
          : html`
              <div class="task-actions">
                <ha-icon-button
                  icon="mdi:check"
                  label="Done"
                  @click=${() => this._done(item)}
                ></ha-icon-button>
                ${canSkip
                  ? html`<ha-icon-button
                      icon="mdi:close"
                      label="Skip"
                      @click=${() => this._skip(item)}
                    ></ha-icon-button>`
                  : ""}
                ${canSnooze
                  ? html`<ha-icon-button
                      icon="mdi:clock-outline"
                      label="Snooze"
                      @click=${() => this._snooze(item)}
                    ></ha-icon-button>`
                  : ""}
              </div>
            `}
      </div>
    `;
  }

  private async _fetchItems() {
    if (!this.hass || !this._config) return;
    try {
      const result = await this.hass.connection.sendMessagePromise<{ items: TodoItem[] }>({
        type: "todo/item/list",
        entity_id: this._config.todo_entity ?? "todo.daynest_today",
      });
      this._items = result.items;
    } catch (error) {
      console.error("Failed to fetch Daynest todo items", error);
    }
  }

  private async _fetchWeek() {
    if ((this._config?.view ?? "full") !== "week") return;
    try {
      const response = await fetch("/api/v1/analytics/summary?period=week");
      if (!response.ok) return;
      const summary = (await response.json()) as WeekSummaryResponse;
      this._week = this._normalizeWeek(summary);
    } catch (error) {
      console.error("Failed to fetch Daynest weekly analytics summary", error);
    }
  }

  private _normalizeWeek(summary: WeekSummaryResponse): WeekDaySummary[] {
    const totals = new Map<string, WeekDaySummary>();
    const add = (date: string, completed: number, total: number) => {
      const current = totals.get(date) ?? { date, completed: 0, total: 0 };
      current.completed += completed;
      current.total += total;
      totals.set(date, current);
    };

    for (const item of summary.chores?.daily_completions ?? []) add(item.date, item.completed, item.total);
    for (const item of summary.planned_items?.daily_completions ?? []) add(item.date, item.completed, item.total);
    for (const item of summary.routines?.daily_completions ?? []) add(item.date, item.completed, item.total);
    for (const item of summary.medications?.daily_adherence ?? []) add(item.date, item.taken, item.total);

    const all = [...totals.values()].sort((a, b) => a.date.localeCompare(b.date));
    const lastDate = all.length > 0 ? new Date(`${all[all.length - 1].date}T00:00:00`) : new Date();
    const day = (lastDate.getDay() + 6) % 7;
    const monday = new Date(lastDate);
    monday.setDate(lastDate.getDate() - day);

    const result: WeekDaySummary[] = [];
    for (let i = 0; i < 7; i += 1) {
      const current = new Date(monday);
      current.setDate(monday.getDate() + i);
      const key = current.toISOString().slice(0, 10);
      result.push(totals.get(key) ?? { date: key, completed: 0, total: 0 });
    }
    return result;
  }

  private _renderWeekView() {
    return html`
      <div class="week-grid">
        ${this._week.map((day) => {
          const date = new Date(`${day.date}T00:00:00`);
          const ratio = day.total > 0 ? Math.round((day.completed / day.total) * 100) : 0;
          return html`
            <div class="week-day">
              <div class="week-day-label">
                ${date.toLocaleDateString(undefined, { weekday: "short" })}
                ${date.toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}
              </div>
              <div class="week-ratio-pill">${ratio}%</div>
              <div>${day.completed}/${day.total}</div>
            </div>
          `;
        })}
      </div>
    `;
  }

  private async _done(item: TodoItem) {
    const parsedUid = parseUid(item.uid);
    if (parsedUid === null) return;
    const { prefix, id } = parsedUid;
    const { service, dataKey } = serviceMap[prefix].done;
    try {
      await this.hass.callService("daynest", service, { [dataKey]: id });
      await this._fetchItems();
    } catch (error) {
      console.error("Failed to mark Daynest todo item as done", error);
    }
  }

  private async _skip(item: TodoItem) {
    const parsedUid = parseUid(item.uid);
    if (parsedUid === null) return;
    const { prefix, id } = parsedUid;
    if (!isSkippablePrefix(prefix)) return;
    const action = serviceMap[prefix].skip;
    try {
      await this.hass.callService("daynest", action.service, { [action.dataKey]: id });
      await this._fetchItems();
    } catch (error) {
      console.error("Failed to skip Daynest todo item", error);
    }
  }

  private async _snooze(item: TodoItem) {
    const parsedUid = parseUid(item.uid);
    if (parsedUid === null) return;
    const { prefix, id } = parsedUid;
    if (!isSnoozablePrefix(prefix)) return;
    const configuredSnoozeDays = Number(this._config.snooze_days);
    const derivedSnoozeDays = Number(
      this.hass.states[(this._config.sensor_prefix ?? DEFAULT_SENSOR_PREFIX).replace(/^sensor\./, "number.") + "snooze_days"]
        ?.state ?? 1,
    );
    const snoozeDays = Number.isFinite(configuredSnoozeDays) && configuredSnoozeDays > 0
      ? Math.round(configuredSnoozeDays)
      : Number.isFinite(derivedSnoozeDays) && derivedSnoozeDays > 0
        ? Math.round(derivedSnoozeDays)
        : 1;
    try {
      await this.hass.callService("daynest", "snooze_task", {
        chore_instance_id: id,
        days: snoozeDays,
      });
      await this._fetchItems();
    } catch (error) {
      console.error("Failed to snooze Daynest todo item", error);
    }
  }

  private async _refresh() {
    try {
      await this.hass.callService("daynest", "refresh", {});
    } catch (error) {
      console.error("Failed to refresh Daynest data", error);
    }
    await this._fetchItems();
    await this._fetchWeek();
  }

  private _renderQuickAdd() {
    return html`
      <details class="quick-add" @toggle=${(event: Event) => (this._quickAddOpen = (event.currentTarget as HTMLDetailsElement).open)}>
        <summary>Quick add</summary>
        ${this._quickAddOpen
          ? html`
              <div class="quick-add-row">
                <input
                  placeholder="Planned item title"
                  .value=${this._quickAddTitle}
                  @input=${(event: Event) => (this._quickAddTitle = (event.target as HTMLInputElement).value)}
                />
                <input
                  type="date"
                  .value=${this._quickAddPlannedFor}
                  @input=${(event: Event) => (this._quickAddPlannedFor = (event.target as HTMLInputElement).value)}
                />
                <ha-icon-button
                  icon=${this._quickAddPending ? "mdi:loading" : "mdi:plus"}
                  label="Add"
                  @click=${this._submitQuickAdd}
                ></ha-icon-button>
              </div>
            `
          : ""}
      </details>
    `;
  }

  private async _submitQuickAdd() {
    const title = this._quickAddTitle.trim();
    if (!title || this._quickAddPending) return;
    this._quickAddPending = true;
    try {
      await this.hass.callService("daynest", "create_planned_item", {
        title,
        planned_for: this._quickAddPlannedFor || undefined,
      });
      this._quickAddTitle = "";
      this._quickAddPlannedFor = "";
      await this._fetchItems();
    } catch (error) {
      console.error("Failed to create Daynest planned item", error);
    } finally {
      this._quickAddPending = false;
    }
  }
}

const daynestWindow = window as WindowWithCustomCards;
daynestWindow.customCards = daynestWindow.customCards ?? [];
if (!daynestWindow.customCards.some((card) => card.type === "daynest-card")) {
  daynestWindow.customCards.push({
    type: "daynest-card",
    name: "Daynest Card",
    description: "Today summary, task list, and medication tracking for Daynest.",
    preview: true,
    documentationURL: "https://github.com/tjorim/daynest",
  });
}
