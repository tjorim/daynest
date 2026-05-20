import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { HomeAssistant } from "custom-card-helpers";
import { DaynestCardConfig, sensorNum, sensorStr } from "./types";
import { cardStyles } from "./styles";

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
        <!-- task list added by tjorim/daynest#207 -->
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

  private _refresh() {
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
