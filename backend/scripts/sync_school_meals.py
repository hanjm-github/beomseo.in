"""
Sync school lunch data from the official NEIS meal API into MySQL.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from datetime import date, datetime, timedelta, timezone
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
from fastapi_app.services.meals import SchoolMealError, sync_school_meals  # noqa: E402


KST = timezone(timedelta(hours=9))


def _parse_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f'잘못된 날짜 형식입니다: {value}') from exc


def _parse_year(value: str) -> int:
    normalized = value.strip().lower()
    if normalized == 'current':
        return datetime.now(KST).year
    try:
        parsed = int(normalized)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f'잘못된 연도 형식입니다: {value}') from exc
    if parsed < 2000 or parsed > 2100:
        raise argparse.ArgumentTypeError(f'지원하지 않는 연도입니다: {value}')
    return parsed


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description='Sync school lunch data from NEIS.')
    parser.add_argument(
        '--year',
        type=_parse_year,
        default=datetime.now(KST).year,
        help='sync a full year (default: current Seoul year, accepts "current")',
    )
    parser.add_argument('--from', dest='from_date', type=_parse_date, help='manual range start date')
    parser.add_argument('--to', dest='to_date', type=_parse_date, help='manual range end date')
    parser.add_argument('--dry-run', action='store_true', help='fetch and diff without committing changes')
    parser.add_argument(
        '--allow-empty',
        action='store_true',
        help='allow zero fetched rows without failing the sync',
    )
    return parser


async def _run_sync(args: argparse.Namespace) -> dict:
    settings = get_settings()
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = get_session_factory()

    year = args.year
    start_date = None
    end_date = None
    if args.from_date or args.to_date:
        if not args.from_date or not args.to_date:
            raise SchoolMealError('--from 과 --to 는 함께 지정해야 합니다.', 422)
        year = None
        start_date = args.from_date
        end_date = args.to_date

    async with session_factory() as session:
        stats = await sync_school_meals(
            session,
            settings,
            year=year,
            start_date=start_date,
            end_date=end_date,
            dry_run=args.dry_run,
            allow_empty=args.allow_empty,
        )
    await shutdown_engine()
    return {
        'requestedFrom': stats.requestedFrom,
        'requestedTo': stats.requestedTo,
        'fetchedRows': stats.fetchedRows,
        'normalizedRows': stats.normalizedRows,
        'created': stats.created,
        'updated': stats.updated,
        'unchanged': stats.unchanged,
        'pruned': stats.pruned,
        'dryRun': stats.dryRun,
        'allowEmpty': stats.allowEmpty,
        'syncedAt': stats.syncedAt,
    }


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        result = asyncio.run(_run_sync(args))
    except SchoolMealError as exc:
        print(exc.message, file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print('동기화가 중단되었습니다.', file=sys.stderr)
        return 130

    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
