# Examples

This page provides ready-to-use examples for automations, dashboards, and blueprints
with the Daynest custom integration.

Replace entity IDs like `sensor.daynest_*` with your actual entity IDs after
setting up the integration.

## Automations

### Notify when tasks are overdue

```yaml
automation:
  - alias: "Alert when tasks are overdue"
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

### Notify when completion ratio drops below threshold

```yaml
automation:
  - alias: "Alert when completion is low"
    trigger:
      - trigger: numeric_state
        entity_id: sensor.daynest_completion_ratio
        below: 50
    action:
      - action: notify.notify
        data:
          title: "Daynest"
          message: "Task completion is at {{ trigger.to_state.state }}%"
```

### Notify when medication is due

```yaml
automation:
  - alias: "Medication due reminder"
    trigger:
      - trigger: numeric_state
        entity_id: sensor.daynest_medication_due_count
        above: 0
    action:
      - action: notify.notify
        data:
          title: "Medication reminder"
          message: "{{ trigger.to_state.state }} medication(s) due. Next: {{ states('sensor.daynest_next_medication') }}"
```

### Use a blueprint for threshold alerts

Save this as a blueprint file and import it in Home Assistant:

```yaml
blueprint:
  name: Daynest — Threshold Alert
  description: Send a notification when a sensor exceeds a configurable threshold.
  domain: automation
  input:
    sensor_entity:
      name: Sensor
      selector:
        entity:
          domain: sensor
          integration: daynest
    threshold:
      name: Threshold value
      selector:
        number:
          min: 0
          max: 1000
    notify_target:
      name: Notification service
      default: notify.notify
      selector:
        text:

trigger:
  - trigger: numeric_state
    entity_id: !input sensor_entity
    above: !input threshold

action:
  - action: !input notify_target
    data:
      message: >-
        {{ state_attr(trigger.entity_id, 'friendly_name') }}
        exceeded {{ threshold }} (current value: {{ trigger.to_state.state }}).
```

## Dashboard Cards

### Sensor value card

```yaml
type: sensor
entity: sensor.daynest_due_today_count
name: Tasks Due Today
graph: line
```

### Task summary — entities card

```yaml
type: entities
title: Daynest
entities:
  - entity: sensor.daynest_due_today_count
    name: Due Today
  - entity: sensor.daynest_overdue_count
    name: Overdue
  - entity: sensor.daynest_planned_count
    name: Planned
  - entity: sensor.daynest_completion_ratio
    name: Completion
```

### Status badge — glance card

```yaml
type: glance
title: Daynest Summary
entities:
  - entity: sensor.daynest_due_today_count
    name: Due Today
  - entity: sensor.daynest_overdue_count
    name: Overdue
  - entity: sensor.daynest_completion_ratio
    name: Done
show_state: true
```

### History graph

```yaml
type: history-graph
title: Completion Ratio (last 24 h)
entities:
  - entity: sensor.daynest_completion_ratio
hours_to_show: 24
```

## Related Documentation

- [Configuration Reference](./CONFIGURATION.md) - All configuration options
- [Getting Started](./GETTING_STARTED.md) - Installation and initial setup
- [GitHub Issues](https://github.com/daynest/daynest-home-assistant/issues) - Report problems
