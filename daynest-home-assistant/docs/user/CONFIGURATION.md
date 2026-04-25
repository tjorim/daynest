# Configuration Reference

This document describes all configuration options and settings available in the Daynest custom integration.

## Integration Configuration

### Initial Setup Options

These options are configured during initial setup via the Home Assistant UI.

#### Connection Settings

| Option | Type | Required | Description |
| --- | --- | --- | --- |
| **Base URL** | string (URL) | Yes | The URL of your Daynest backend |
| **API Key** | string | Yes | Your Daynest integration API key |

## Entity Configuration

### Entity Customization

Customize entities via the UI or `configuration.yaml`:

#### Via Home Assistant UI

1. Go to **Settings** → **Devices & Services** → **Entities**
2. Find and click the entity
3. Click the settings icon
4. Modify:
   - Entity ID
   - Name
   - Icon
   - Area assignment

#### Via configuration.yaml

```yaml
homeassistant:
  customize:
    sensor.daynest_due_today_count:
      friendly_name: "Tasks Due Today"
      icon: mdi:format-list-checks
```

### Disabling Entities

If you don't need certain entities:

1. Go to **Settings** → **Devices & Services** → **Entities**
2. Find the entity
3. Click it, then click **Settings** icon
4. Toggle **Enable entity** off

Disabled entities won't update or consume resources.

## Advanced Configuration

### Multiple Instances

You can add multiple instances of this integration for different Daynest backends:

1. Go to **Settings** → **Devices & Services**
2. Click **+ Add Integration**
3. Search for "Daynest"
4. Configure with different base URL and API key

Each instance creates separate entities with unique entity IDs.

## Diagnostic Data

The integration provides diagnostic data for troubleshooting:

1. Go to **Settings** → **Devices & Services**
2. Find "Daynest"
3. Click on the device
4. Click **Download Diagnostics**

Diagnostic data includes:

- Connection status
- Last update timestamp
- API response data
- Entity states
- Error history

**Privacy note:** Diagnostic data may contain sensitive information. Review before sharing.

## Blueprints

The integration works with Home Assistant Blueprints for reusable automations:

### Example Blueprint

```yaml
blueprint:
  name: Daynest Alert
  description: Send notification when sensor exceeds threshold
  domain: automation
  input:
    sensor_entity:
      name: Sensor
      selector:
        entity:
          domain: sensor
          integration: daynest
    threshold:
      name: Threshold
      selector:
        number:
          min: 0
          max: 100

trigger:
  - trigger: numeric_state
    entity_id: !input sensor_entity
    above: !input threshold

action:
  - action: notify.notify
    data:
      message: "Sensor exceeded threshold!"
```

## Configuration Examples

See [EXAMPLES.md](./EXAMPLES.md) for complete automation and dashboard examples.

## Troubleshooting Configuration

### Config Entry Fails to Load

If the integration fails to load after configuration:

1. Check Home Assistant logs for errors
2. Verify the base URL is reachable and the API key is correct
3. Try removing and re-adding the integration

## Related Documentation

- [Getting Started](./GETTING_STARTED.md) - Installation and initial setup
- [Examples](./EXAMPLES.md) - Automation and dashboard examples
- [GitHub Issues](https://github.com/daynest/daynest-home-assistant/issues) - Report problems
