import { css } from "lit";

export const cardStyles = css`
  :host {
    display: block;
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
`;
