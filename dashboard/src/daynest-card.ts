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

const metricSensorSuffixes: MetricSensorSuffix[] = metricSensorDefinitions.map(
  (metric) => metric.suffix,
);

type WindowWithCustomCards = Window & {
  customCards?: Array<{
    type: string;
    name: string;
    description: string;
    preview: boolean;
  }>;
};

@customElement("daynest-card")
class DaynestCard extends LitElement {
  static styles = cardStyles;

  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config!: DaynestCardConfig;
  @state() private _items: TodoItem[] = [];

  connectedCallback() {
    super.connectedCallback();
    void this._fetchItems();
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
      ],
    };
  }

  static getStubConfig(): DaynestCardConfig {
    return {
      type: "custom:daynest-card",
      sensor_prefix: DEFAULT_SENSOR_PREFIX,
      todo_entity: "todo.daynest_today",
    };
  }

  setConfig(config: DaynestCardConfig) {
    if (!config) throw new Error("Invalid configuration");
    this._config = config;
    void this._fetchItems();
  }

  getCardSize(): number {
    return 4;
  }

  getGridOptions(): CardGridOptions {
    return { columns: 12, rows: 4, min_columns: 6, min_rows: 3 };
  }

  protected updated(changedProps: PropertyValues<this>) {
    if (changedProps.has("hass") && this._items.length === 0) {
      void this._fetchItems();
    }
  }

  render() {
    if (!this.hass || !this._config) return html``;

    const prefix = this._config.sensor_prefix ?? DEFAULT_SENSOR_PREFIX;
    const metricValue = (suffix: MetricSensorSuffix) => sensorNum(this.hass, prefix + suffix);
    const pct = Math.max(0, Math.min(100, Math.round(metricValue("completion_ratio"))));

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
    return html`
      <div class=${`task-item${isDone ? " done" : ""}`}>
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
    try {
      await this.hass.callService("daynest", "snooze_task", {
        chore_instance_id: id,
        days: 1,
      });
      await this._fetchItems();
    } catch (error) {
      console.error("Failed to snooze Daynest todo item", error);
    }
  }

  private async _refresh() {
    const prefix = this._config.sensor_prefix ?? DEFAULT_SENSOR_PREFIX;
    try {
      await this.hass.callService("homeassistant", "update_entity", {
        entity_id: metricSensorSuffixes.map((suffix) => prefix + suffix),
      });
    } catch (error) {
      console.error("Failed to refresh Daynest sensors", error);
    }
    await this._fetchItems();
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
  });
}
