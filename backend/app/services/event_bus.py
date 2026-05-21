import asyncio
from collections import defaultdict


class EventBus:
    """Process-local SSE event fanout for the single-worker backend deployment."""

    def __init__(self) -> None:
        self._queues: dict[int, list[tuple[asyncio.AbstractEventLoop, asyncio.Queue[dict]]]] = defaultdict(list)

    def subscribe(self, user_id: int) -> asyncio.Queue[dict]:
        queue: asyncio.Queue[dict] = asyncio.Queue()
        self._queues[user_id].append((asyncio.get_running_loop(), queue))
        return queue

    def unsubscribe(self, user_id: int, queue: asyncio.Queue[dict]) -> None:
        queues = self._queues.get(user_id)
        if not queues:
            return
        remaining = [(loop, active_queue) for loop, active_queue in queues if active_queue is not queue]
        if len(remaining) == len(queues):
            return
        if not remaining:
            self._queues.pop(user_id, None)
            return
        self._queues[user_id] = remaining

    def subscribed_user_ids(self) -> set[int]:
        return set(self._queues)

    def publish(self, user_id: int, event: dict) -> None:
        for loop, queue in list(self._queues.get(user_id, [])):
            loop.call_soon_threadsafe(queue.put_nowait, event)
