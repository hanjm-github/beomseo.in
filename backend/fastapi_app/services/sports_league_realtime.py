"""
Async realtime publish/subscribe for sports league SSE streams.

Uses asyncio primitives for in-process pub/sub and redis.asyncio for
cross-process coordination.
"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from redis.asyncio import Redis as AsyncRedis

from ..config import Settings


CHANNEL_NAME = 'sports_league:snapshot_updates'
STREAM_SLOT_KEY_PREFIX = 'sports_league:stream_clients'

_LOCAL_SUBSCRIBERS: dict[str, set[asyncio.Queue]] = {}
_LOCAL_SUBSCRIBERS_LOCK = asyncio.Lock()
_LOCAL_STREAM_SLOTS: dict[tuple, int] = {}
_LOCAL_STREAM_SLOTS_LOCK = asyncio.Lock()


# ---------------------------------------------------------------------------
# Redis helpers
# ---------------------------------------------------------------------------

async def _redis_client(settings: Settings) -> AsyncRedis | None:
    redis_url = settings.REDIS_URL
    if not redis_url:
        return None
    try:
        client = AsyncRedis.from_url(
            redis_url,
            decode_responses=True,
            socket_connect_timeout=1,
            socket_timeout=1,
        )
        await client.ping()
        return client
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Local in-process pub/sub
# ---------------------------------------------------------------------------

async def _register_local(category_id: str) -> asyncio.Queue:
    queue: asyncio.Queue = asyncio.Queue(maxsize=100)
    async with _LOCAL_SUBSCRIBERS_LOCK:
        listeners = _LOCAL_SUBSCRIBERS.setdefault(category_id, set())
        listeners.add(queue)
    return queue


async def _unregister_local(category_id: str, queue: asyncio.Queue):
    async with _LOCAL_SUBSCRIBERS_LOCK:
        listeners = _LOCAL_SUBSCRIBERS.get(category_id)
        if not listeners:
            return
        listeners.discard(queue)
        if not listeners:
            _LOCAL_SUBSCRIBERS.pop(category_id, None)


async def _publish_local(category_id: str):
    async with _LOCAL_SUBSCRIBERS_LOCK:
        listeners = list(_LOCAL_SUBSCRIBERS.get(category_id, set()))
    for queue in listeners:
        try:
            queue.put_nowait(category_id)
        except Exception:
            continue


# ---------------------------------------------------------------------------
# Stream slot management
# ---------------------------------------------------------------------------

def _stream_slot_ttl(settings: Settings) -> int:
    return max(settings.SPORTS_LEAGUE_SSE_HEARTBEAT_SECONDS * 8, 60)


async def acquire_stream_slot(
    client_key: str,
    category_id: str,
    settings: Settings,
) -> bool:
    max_streams = settings.SPORTS_LEAGUE_MAX_STREAMS_PER_CLIENT
    ttl_seconds = _stream_slot_ttl(settings)
    client = await _redis_client(settings)

    if client is not None:
        key = f'{STREAM_SLOT_KEY_PREFIX}:{category_id}:{client_key}'
        current_count = None
        try:
            current_count = int(await client.incr(key))
            await client.expire(key, ttl_seconds)
            if current_count > max_streams:
                await client.decr(key)
                return False
            return True
        except Exception:
            if current_count is not None:
                try:
                    remaining = int(await client.decr(key))
                    if remaining <= 0:
                        await client.delete(key)
                except Exception:
                    pass
        finally:
            try:
                await client.aclose()
            except Exception:
                pass

    local_key = (category_id, client_key)
    async with _LOCAL_STREAM_SLOTS_LOCK:
        current_count = _LOCAL_STREAM_SLOTS.get(local_key, 0)
        if current_count >= max_streams:
            return False
        _LOCAL_STREAM_SLOTS[local_key] = current_count + 1
    return True


async def release_stream_slot(
    client_key: str,
    category_id: str,
    settings: Settings,
):
    client = await _redis_client(settings)
    if client is not None:
        key = f'{STREAM_SLOT_KEY_PREFIX}:{category_id}:{client_key}'
        try:
            remaining = int(await client.decr(key))
            if remaining <= 0:
                await client.delete(key)
            else:
                await client.expire(key, _stream_slot_ttl(settings))
            return
        except Exception:
            pass
        finally:
            try:
                await client.aclose()
            except Exception:
                pass

    local_key = (category_id, client_key)
    async with _LOCAL_STREAM_SLOTS_LOCK:
        current_count = _LOCAL_STREAM_SLOTS.get(local_key, 0)
        if current_count <= 1:
            _LOCAL_STREAM_SLOTS.pop(local_key, None)
            return
        _LOCAL_STREAM_SLOTS[local_key] = current_count - 1


# ---------------------------------------------------------------------------
# Subscription classes
# ---------------------------------------------------------------------------

class AsyncLocalSubscription:
    def __init__(self, queue: asyncio.Queue):
        self.queue = queue

    async def wait(self, timeout: float) -> bool:
        try:
            await asyncio.wait_for(self.queue.get(), timeout=timeout)
            return True
        except asyncio.TimeoutError:
            return False


class AsyncRedisSubscription:
    def __init__(self, category_id: str, pubsub):
        self.category_id = category_id
        self.pubsub = pubsub

    async def wait(self, timeout: float) -> bool:
        import time
        deadline = time.monotonic() + timeout
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                return False
            try:
                message = await asyncio.wait_for(
                    self.pubsub.get_message(ignore_subscribe_messages=True),
                    timeout=remaining,
                )
            except asyncio.TimeoutError:
                return False
            if not message:
                # Small sleep to avoid busy-wait when get_message returns None immediately
                await asyncio.sleep(min(0.1, max(0, remaining)))
                continue
            if str(message.get('data') or '') == self.category_id:
                return True


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def publish_category_update(category_id: str, settings: Settings):
    """Notify all subscribers that the category snapshot has changed."""
    client = await _redis_client(settings)
    if client is None:
        await _publish_local(category_id)
        return
    try:
        await client.publish(CHANNEL_NAME, category_id)
    except Exception:
        await _publish_local(category_id)
    finally:
        try:
            await client.aclose()
        except Exception:
            pass


@asynccontextmanager
async def subscribe_category_updates(category_id: str, settings: Settings):
    """
    Async context manager yielding a subscription object with an
    async wait(timeout) method.
    """
    client = await _redis_client(settings)
    if client is None:
        queue = await _register_local(category_id)
        try:
            yield AsyncLocalSubscription(queue)
        finally:
            await _unregister_local(category_id, queue)
        return

    pubsub = client.pubsub(ignore_subscribe_messages=True)
    await pubsub.subscribe(CHANNEL_NAME)
    try:
        yield AsyncRedisSubscription(category_id, pubsub)
    finally:
        try:
            await pubsub.close()
        finally:
            try:
                await client.aclose()
            except Exception:
                pass
