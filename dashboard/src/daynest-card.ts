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

function parseUid(uid: string): { prefix: string; id: number } {
  const [prefix, rawId] = uid.split(":");
  return { prefix, id: parseInt(rawId, 10) };
}

const serviceMap = {
  due: {
    done: { service: "complete_chore", dataKey: "chore_instance_id" },
    skip: { service: "skip_chore", dataKey: "chore_instance_id" },
  },
  overdue: {
    done: { service: "complete_chore", dataKey: "chore_instance_id" },
    skip: { service: "skip_chore", dataKey: "chore_instance_id" },
  },
  routine: {
    done: { service: "complete_routine_task", dataKey: "task_instance_id" },
    skip: { service: "skip_routine_task", dataKey: "task_instance_id" },
  },
  medication: {
    done: { service: "take_medication_dose", dataKey: "dose_instance_id" },
    skip: { service: "skip_medication_dose", dataKey: "dose_instance_id" },
  },
  planned: {
    done: { service: "mark_planned_done", dataKey: "id" },
  },
} as const;

type ServicePrefix = keyof typeof serviceMap;

function isServicePrefix(prefix: string): prefix is ServicePrefix {
  return prefix in serviceMap;
}

function isSnoozablePrefix(prefix: string): boolean {
  return prefix === "due" || prefix === "overdue";
}

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

  static getConfigElement() {
    return document.createElement("daynest-card-editor");
  }

  static getStubConfig(): DaynestCardConfig {
    return {
      type: "custom:daynest-card",
      sensor_prefix: "sensor.daynest_",
      todo_entity: "todo.daynest_today",
    };
  }

  setConfig(config: DaynestCardConfig) {
    if (!config) throw new Error("Invalid configuration");
    this._config = config;
    void this._fetchItems();
  }

  protected updated(changedProps: PropertyValues<this>) {
    if (changedProps.has("hass") && this._items.length === 0) {
      void this._fetchItems();
    }
  }

  render() {
    if (!this.hass || !this._config) return html``;

    const prefix = this._config.sensor_prefix ?? "sensor.daynest_";
    const routinesTotal = sensorNum(this.hass, prefix + "routines_count");
    const routinesDone = sensorNum(this.hass, prefix + "routines_completed_today");
    const choresTotal = sensorNum(this.hass, prefix + "chores_count");
    const choresDone = sensorNum(this.hass, prefix + "chores_completed_today");
    const medTotal = sensorNum(this.hass, prefix + "medications_count");
    const medDone = sensorNum(this.hass, prefix + "medications_taken_today");
    const plannedTotal = sensorNum(this.hass, prefix + "planned_pending_count");
    const plannedDone = sensorNum(this.hass, prefix + "planned_done_today");
    const total = routinesTotal + choresTotal + medTotal + plannedTotal;
    const done = routinesDone + choresDone + medDone + plannedDone;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    const nextMed = sensorStr(this.hass, prefix + "next_medication_time");
    const showMed = nextMed && nextMed !== "unavailable" && nextMed !== "unknown";

    return html`
      <ha-card>
        <div class="card-header">
          <span>${this._config.name ?? "Today"}</span>
          <ha-icon-button icon="mdi:refresh" @click=${this._refresh}></ha-icon-button>
        </div>
        <div class="ratio-bar"><div class="ratio-fill" style=${`width:${pct}%`}></div></div>
        <div class="metrics-bar">
          ${this._metricTile(routinesDone, routinesTotal, "Routines")}
          ${this._metricTile(choresDone, choresTotal, "Chores")}
          ${this._metricTile(medDone, medTotal, "Medication")}
          ${this._metricTile(plannedDone, plannedTotal, "Planned")}
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

  private _metricTile(done: number, total: number, label: string) {
    return html`
      <div class="metric-tile">
        <span class="metric-value">${done}/${total}</span>
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
    const { prefix } = parseUid(item.uid);
    const canSkip = prefix !== "planned";
    const canSnooze = isSnoozablePrefix(prefix);
    const isDone = item.status === "completed";
    return html`
      <div class=${`task-item${isDone ? " done" : ""}`}>
        <span>${item.summary}</span>
        ${isDone
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
    const { prefix, id } = parseUid(item.uid);
    if (!isServicePrefix(prefix)) return;
    const { service, dataKey } = serviceMap[prefix].done;
    try {
      await this.hass.callService("daynest", service, { [dataKey]: id });
      await this._fetchItems();
    } catch (error) {
      console.error("Failed to mark Daynest todo item as done", error);
    }
  }

  private async _skip(item: TodoItem) {
    const { prefix, id } = parseUid(item.uid);
    if (!isServicePrefix(prefix) || prefix === "planned") return;
    const action = serviceMap[prefix].skip;
    if (!action) return;
    try {
      await this.hass.callService("daynest", action.service, { [action.dataKey]: id });
      await this._fetchItems();
    } catch (error) {
      console.error("Failed to skip Daynest todo item", error);
    }
  }

  private async _snooze(item: TodoItem) {
    const { prefix, id } = parseUid(item.uid);
    if (!isSnoozablePrefix(prefix)) return;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    try {
      await this.hass.callService("daynest", "reschedule_chore", {
        chore_instance_id: id,
        scheduled_date: tomorrow.toISOString().slice(0, 10),
      });
      await this._fetchItems();
    } catch (error) {
      console.error("Failed to snooze Daynest todo item", error);
    }
  }

  private async _refresh() {
    await this._fetchItems();
    this.requestUpdate();
  }
}

const daynestWindow = window as WindowWithCustomCards;
daynestWindow.customCards = daynestWindow.customCards ?? [];
daynestWindow.customCards.push({
  type: "daynest-card",
  name: "Daynest Card",
  description: "Today summary, task list, and medication tracking for Daynest.",
  preview: true,
});
