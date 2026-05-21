import asyncio
from collections import defaultdict


class EventBus:
    def __init__(self) -> None:
        self._queues: dict[int, list[asyncio.Queue[dict]]] = defaultdict(list)

    def subscribe(self, user_id: int) -> asyncio.Queue[dict]:
        queue: asyncio.Queue[dict] = asyncio.Queue()
        self._queues[user_id].append(queue)
        return queue

    def unsubscribe(self, user_id: int, queue: asyncio.Queue[dict]) -> None:
        queues = self._queues.get(user_id)
        if not queues:
            return
        try:
            queues.remove(queue)
        except ValueError:
            return
        if not queues:
            self._queues.pop(user_id, None)

    def publish(self, user_id: int, event: dict) -> None:
        for queue in list(self._queues.get(user_id, [])):
            queue.put_nowait(event)
