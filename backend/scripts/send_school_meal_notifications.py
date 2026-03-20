"""
Send due meal reminder notifications for installed PWA devices.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

load_dotenv(BACKEND_DIR / '.env')
os.environ.setdefault('FLASK_ENV', 'development')

from fastapi_app.config import get_settings  # noqa: E402
from fastapi_app.database import get_engine, get_session_factory, shutdown_engine  # noqa: E402
from fastapi_app.models import Base  # noqa: E402
from fastapi_app.services.meal_notifications import send_due_notifications  # noqa: E402
from fastapi_app.services.meals import SchoolMealError  # noqa: E402


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description='Send due school meal reminder notifications.')
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Validate due reminders without updating send state.',
    )
    return parser


async def _run(args: argparse.Namespace) -> dict:
    settings = get_settings()
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = get_session_factory()

    async with session_factory() as session:
        result = await send_due_notifications(
            session,
            settings=settings,
            dry_run=args.dry_run,
        )

    await shutdown_engine()
    return result


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    try:
        result = asyncio.run(_run(args))
    except SchoolMealError as exc:
        print(exc.message, file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print('Notification sending interrupted.', file=sys.stderr)
        return 130

    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
