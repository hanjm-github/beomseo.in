"""
Bootstrap sports league seed data into the database.
"""
from __future__ import annotations

import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import create_app  # noqa: E402
from models import db  # noqa: E402
from services.sports_league import bootstrap_all_sports_leagues  # noqa: E402


def main():
    app = create_app()
    with app.app_context():
        db.create_all()
        snapshots = bootstrap_all_sports_leagues()
        for snapshot in snapshots:
            category = snapshot.get('category', {})
            print(f'bootstrapped: {category.get("id")} ({category.get("title")})')


if __name__ == '__main__':
    main()
