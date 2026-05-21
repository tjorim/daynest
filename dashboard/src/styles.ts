import { css } from "lit";

export const cardStyles = css`
  :host {
    display: block;
    --daynest-color-completed: var(--success-color, #28a745);
    --daynest-color-overdue: var(--error-color, #dc3545);
    --daynest-color-skipped: var(--disabled-color, #6c757d);
    --daynest-color-pending: var(--info-color, #17a2b8);
  }

  ha-card {
    background: var(--card-background-color);
    color: var(--primary-text-color);
    padding: 12px;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    font-weight: 600;
  }

  .metrics-bar {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  .metric-tile {
    flex: 1;
    min-width: 0;
    border: 1px solid var(--divider-color);
    border-radius: 10px;
    padding: 8px;
    text-align: center;
  }

  .metric-value {
    display: block;
    color: var(--primary-text-color);
    font-weight: 600;
  }

  .metric-label {
    display: block;
    color: var(--secondary-text-color);
    font-size: 0.8rem;
    margin-top: 2px;
  }

  .ratio-bar {
    width: 100%;
    height: 8px;
    background: var(--divider-color);
    border-radius: 999px;
    overflow: hidden;
  }

  .ratio-fill {
    height: 100%;
    background: var(--primary-color);
    transition: width 0.2s ease;
  }

  .med-chip {
    display: inline-block;
    margin-top: 10px;
    padding: 4px 10px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--primary-color) 18%, transparent);
    color: var(--primary-text-color);
    font-size: 0.85rem;
  }

  .task-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 12px;
  }

  .task-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 0;
    border-bottom: 1px solid var(--divider-color);
  }

  .task-item.done {
    color: var(--daynest-color-completed);
    text-decoration: line-through;
  }

  .task-item.overdue {
    color: var(--daynest-color-overdue);
  }

  .task-item.skipped {
    color: var(--daynest-color-skipped);
  }

  .task-item.pending {
    color: var(--daynest-color-pending);
  }

  .task-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .task-group-header {
    color: var(--secondary-text-color);
    font-size: 0.8rem;
    font-weight: 600;
    margin-top: 4px;
  }

  .week-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 8px;
    margin-top: 10px;
  }

  .week-day {
    border: 1px solid var(--divider-color);
    border-radius: 10px;
    padding: 8px;
  }

  .week-day-label {
    font-size: 0.8rem;
    color: var(--secondary-text-color);
  }

  .week-ratio-pill {
    margin-top: 6px;
    border-radius: 999px;
    display: inline-block;
    padding: 2px 8px;
    background: color-mix(in srgb, var(--daynest-color-pending) 16%, transparent);
    font-size: 0.78rem;
  }

  .quick-add {
    margin-top: 10px;
    display: grid;
    gap: 6px;
  }

  .quick-add-row {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .quick-add input {
    min-width: 0;
    width: 100%;
    border: 1px solid var(--divider-color);
    border-radius: 8px;
    padding: 6px 8px;
    background: var(--card-background-color);
    color: var(--primary-text-color);
  }
`;
