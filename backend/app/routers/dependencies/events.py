from app.services.event_bus import EventBus

_event_bus = EventBus()


def get_event_bus() -> EventBus:
    return _event_bus
