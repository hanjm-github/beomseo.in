"""
Bootstrap registered sports league seed rows into the shared database.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    # Allow running this file directly from any working directory.
    sys.path.insert(0, str(BACKEND_DIR))

load_dotenv(BACKEND_DIR / '.env')
os.environ.setdefault('FLASK_ENV', 'development')
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from fastapi_app.config import get_settings  # noqa: E402
from fastapi_app.database import get_engine, get_session_factory, shutdown_engine  # noqa: E402
from fastapi_app.models import Base  # noqa: E402
from fastapi_app.services.sports_league import (  # noqa: E402
    SportsLeagueError,
    bootstrap_sports_league_category,
)
from fastapi_app.services.sports_league_seed import (  # noqa: E402
    iter_sports_league_seeds,
    list_sports_league_seed_summaries,
)


def parse_args():
    parser = argparse.ArgumentParser(description='Bootstrap sports league seed data.')
    parser.add_argument(
        '--category-id',
        help='Bootstrap only one registered sports league category.',
    )
    parser.add_argument(
        '--list',
        action='store_true',
        help='List registered sports league seeds without touching the database.',
    )
    return parser.parse_args()


def print_registered_seeds():
    for item in list_sports_league_seed_summaries():
        print(
            f"{item['id']} | {item['title']} | "
            f"{item['scheduleWindowLabel']} | {item['storageVersion']}"
        )


async def ensure_tables():
    # The script may run before migrations in local/dev environments.
    async with get_engine().begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def bootstrap(category_ids):
    settings = get_settings()
    await ensure_tables()

    factory = get_session_factory()
    async with factory() as session:
        for category_id in category_ids:
            try:
                snapshot = await bootstrap_sports_league_category(session, settings, category_id)
            except SportsLeagueError as exc:
                raise SystemExit(f'{category_id}: {exc.message}') from exc

            print(
                f"{category_id}: bootstrapped "
                f"{len(snapshot.get('teams', []))} teams, "
                f"{len(snapshot.get('matches', []))} matches"
            )


async def async_main():
    args = parse_args()
    registered_ids = [category_id for category_id, _seed in iter_sports_league_seeds()]

    if args.list:
        print_registered_seeds()
        return

    if args.category_id:
        if args.category_id not in registered_ids:
            raise SystemExit(f'Unknown sports league category: {args.category_id}')
        category_ids = [args.category_id]
    else:
        # With no filter, refresh every registered category in seed order.
        category_ids = registered_ids

    try:
        await bootstrap(category_ids)
    finally:
        await shutdown_engine()


def main():
    asyncio.run(async_main())


if __name__ == '__main__':
    main()
