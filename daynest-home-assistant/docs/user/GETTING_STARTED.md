# Getting Started with Daynest

This guide will help you install and set up the Daynest custom integration for Home Assistant.

## Prerequisites

- Home Assistant 2025.7.0 or newer
- HACS (Home Assistant Community Store) installed
- Network connectivity to your Daynest backend
- A Daynest API key

## Installation

### Via HACS (Recommended)

1. Open HACS in your Home Assistant instance
2. Go to "Integrations"
3. Click the three dots in the top right corner
4. Select "Custom repositories"
5. Add this repository URL: `https://github.com/daynest/daynest-home-assistant`
6. Set category to "Integration"
7. Click "Add"
8. Find "Daynest" in the integration list
9. Click "Download"
10. Restart Home Assistant

### Manual Installation

1. Download the latest release from the [releases page](https://github.com/daynest/daynest-home-assistant/releases)
2. Extract the `daynest` folder from the archive
3. Copy it to `custom_components/daynest/` in your Home Assistant configuration directory
4. Restart Home Assistant

## Initial Setup

After installation, add the integration:

1. Go to **Settings** → **Devices & Services**
2. Click **+ Add Integration**
3. Search for "Daynest"
4. Enter the required connection details:

### Connection Information

| Field | Description |
| --- | --- |
| **Base URL** | The URL of your Daynest backend (e.g. `https://your-daynest-instance.example.com`) |
| **API Key** | Your Daynest integration API key |

Click **Submit** to test the connection. The integration will verify the credentials before saving.

## What Gets Created

After successful setup, the integration creates the following sensor entities:

| Entity | Description |
| --- | --- |
| `sensor.daynest_due_today_count` | Number of tasks due today |
| `sensor.daynest_overdue_count` | Number of overdue tasks |
| `sensor.daynest_planned_count` | Number of planned tasks |
| `sensor.daynest_medication_due_count` | Number of medications due |
| `sensor.daynest_completion_ratio` | Task completion ratio (%) |
| `sensor.daynest_next_medication` | Time of next scheduled medication |

## First Steps

### Dashboard Cards

Add entities to your dashboard:

1. Go to your dashboard
2. Click **Edit Dashboard** → **Add Card**
3. Choose card type (e.g., "Entities", "Glance")
4. Select entities from "Daynest"

Example entities card:

```yaml
type: entities
title: Daynest
entities:
  - sensor.daynest_due_today_count
  - sensor.daynest_overdue_count
  - sensor.daynest_completion_ratio
```

### Automations

Use the integration in automations:

```yaml
automation:
  - alias: "Notify when tasks are overdue"
    trigger:
      - trigger: numeric_state
        entity_id: sensor.daynest_overdue_count
        above: 0
    action:
      - action: notify.notify
        data:
          title: "Daynest"
          message: "You have {{ trigger.to_state.state }} overdue task(s)!"
```

## Troubleshooting

### Connection Failed

If setup fails with connection errors:

1. Verify the base URL is correct and reachable from Home Assistant
2. Check that the API key is valid
3. Ensure no firewall is blocking the connection
4. Check Home Assistant logs for detailed error messages

### Entities Not Updating

If entities show "Unavailable" or don't update:

1. Check that your Daynest backend is online
2. Verify the API key hasn't expired
3. Review logs: **Settings** → **System** → **Logs**
4. Try reloading the integration

### Debug Logging

Enable debug logging to troubleshoot issues:

```yaml
logger:
  default: warning
  logs:
    custom_components.daynest: debug
```

Add this to `configuration.yaml`, restart, and reproduce the issue. Check logs for detailed information.

## Next Steps

- See [CONFIGURATION.md](./CONFIGURATION.md) for detailed configuration options
- See [EXAMPLES.md](./EXAMPLES.md) for more automation examples
- Report issues at [GitHub Issues](https://github.com/daynest/daynest-home-assistant/issues)

## Support

For help and discussion:

- [GitHub Discussions](https://github.com/daynest/daynest-home-assistant/discussions)
- [Home Assistant Community Forum](https://community.home-assistant.io/)
