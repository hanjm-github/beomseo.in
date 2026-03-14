"""
Realtime publish/subscribe helpers for sports league SSE streams.
"""
from __future__ import annotations

import time
from contextlib import contextmanager
from queue import Empty, Queue
from threading import Lock

from flask import current_app
from redis import Redis
from utils.security import get_client_ip, get_current_principal


CHANNEL_NAME = 'sports_league:snapshot_updates'
STREAM_SLOT_KEY_PREFIX = 'sports_league:stream_clients'
_LOCAL_SUBSCRIBERS = {}
_LOCAL_SUBSCRIBERS_LOCK = Lock()
_LOCAL_STREAM_SLOTS = {}
_LOCAL_STREAM_SLOTS_LOCK = Lock()


def _redis_client():
    redis_url = current_app.config.get('REDIS_URL')
    if not redis_url:
        return None

    connect_timeout = int(current_app.config.get('CACHE_SOCKET_CONNECT_TIMEOUT', 1) or 1)
    socket_timeout = int(current_app.config.get('CACHE_SOCKET_TIMEOUT', 1) or 1)
    try:
        client = Redis.from_url(
            redis_url,
            decode_responses=True,
            socket_connect_timeout=connect_timeout,
            socket_timeout=socket_timeout,
        )
        client.ping()
        return client
    except Exception:
        return None


def _register_local(category_id):
    queue = Queue(maxsize=100)
    with _LOCAL_SUBSCRIBERS_LOCK:
        listeners = _LOCAL_SUBSCRIBERS.setdefault(category_id, set())
        listeners.add(queue)
    return queue


def _unregister_local(category_id, queue):
    with _LOCAL_SUBSCRIBERS_LOCK:
        listeners = _LOCAL_SUBSCRIBERS.get(category_id)
        if not listeners:
            return
        listeners.discard(queue)
        if not listeners:
            _LOCAL_SUBSCRIBERS.pop(category_id, None)


def _publish_local(category_id):
    with _LOCAL_SUBSCRIBERS_LOCK:
        listeners = list(_LOCAL_SUBSCRIBERS.get(category_id, set()))

    # Local queues keep single-process development usable when Redis pub/sub is unavailable.
    for queue in listeners:
        try:
            queue.put_nowait(category_id)
        except Exception:
            continue


def _stream_slot_ttl_seconds():
    heartbeat_seconds = int(current_app.config.get('SPORTS_LEAGUE_SSE_HEARTBEAT_SECONDS', 15) or 15)
    return max(heartbeat_seconds * 8, 60)


def _stream_slot_key(client_key, category_id):
    return f'{STREAM_SLOT_KEY_PREFIX}:{category_id}:{client_key}'


def build_stream_client_key():
    principal = get_current_principal(optional=True)
    if principal and principal.get('id') not in (None, ''):
        return f'user:{principal["id"]}'

    client_ip = get_client_ip()
    if client_ip:
        return f'ip:{client_ip}'
    return 'anon:unknown'


def acquire_stream_slot(client_key, category_id):
    max_streams = int(current_app.config.get('SPORTS_LEAGUE_MAX_STREAMS_PER_CLIENT', 2) or 2)
    ttl_seconds = _stream_slot_ttl_seconds()
    client = _redis_client()

    # Redis coordination lets multiple workers share the same per-client stream counters.
    if client is not None:
        key = _stream_slot_key(client_key, category_id)
        current_count = None
        try:
            current_count = int(client.incr(key))
            client.expire(key, ttl_seconds)
            if current_count > max_streams:
                client.decr(key)
                return False
            return True
        except Exception:
            if current_count is not None:
                try:
                    remaining = int(client.decr(key))
                    if remaining <= 0:
                        client.delete(key)
                except Exception:
                    pass
        finally:
            try:
                client.close()
            except Exception:
                pass

    local_key = (category_id, client_key)
    with _LOCAL_STREAM_SLOTS_LOCK:
        current_count = _LOCAL_STREAM_SLOTS.get(local_key, 0)
        if current_count >= max_streams:
            return False
        _LOCAL_STREAM_SLOTS[local_key] = current_count + 1
    return True


def release_stream_slot(client_key, category_id):
    client = _redis_client()
    if client is not None:
        key = _stream_slot_key(client_key, category_id)
        try:
            remaining = int(client.decr(key))
            if remaining <= 0:
                client.delete(key)
            else:
                client.expire(key, _stream_slot_ttl_seconds())
            return
        except Exception:
            pass
        finally:
            try:
                client.close()
            except Exception:
                pass

    local_key = (category_id, client_key)
    with _LOCAL_STREAM_SLOTS_LOCK:
        current_count = _LOCAL_STREAM_SLOTS.get(local_key, 0)
        if current_count <= 1:
            _LOCAL_STREAM_SLOTS.pop(local_key, None)
            return
        _LOCAL_STREAM_SLOTS[local_key] = current_count - 1


class LocalSubscription:
    def __init__(self, queue):
        self.queue = queue

    def wait(self, timeout):
        try:
            self.queue.get(timeout=timeout)
            return True
        except Empty:
            return False


class RedisSubscription:
    def __init__(self, category_id, pubsub):
        self.category_id = category_id
        self.pubsub = pubsub

    def wait(self, timeout):
        deadline = time.monotonic() + timeout
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                return False
            message = self.pubsub.get_message(ignore_subscribe_messages=True, timeout=remaining)
            if not message:
                return False
            if str(message.get('data') or '') == self.category_id:
                return True


def publish_category_update(category_id):
    client = _redis_client()
    if client is None:
        _publish_local(category_id)
        return

    try:
        client.publish(CHANNEL_NAME, category_id)
    except Exception:
        _publish_local(category_id)
    finally:
        try:
            client.close()
        except Exception:
            pass


@contextmanager
def subscribe_category_updates(category_id):
    client = _redis_client()
    if client is None:
        queue = _register_local(category_id)
        try:
            yield LocalSubscription(queue)
        finally:
            _unregister_local(category_id, queue)
        return

    # Redis and in-process subscriptions expose the same wait() contract to the SSE route.
    pubsub = client.pubsub(ignore_subscribe_messages=True)
    pubsub.subscribe(CHANNEL_NAME)
    try:
        yield RedisSubscription(category_id, pubsub)
    finally:
        try:
            pubsub.close()
        finally:
            try:
                client.close()
            except Exception:
                pass
