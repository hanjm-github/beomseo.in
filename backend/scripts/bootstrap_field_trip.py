"""
Bootstrap the default field-trip class rows.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

load_dotenv(BACKEND_DIR / '.env')
os.environ.setdefault('FLASK_ENV', 'development')

from app import create_app  # noqa: E402
from utils.field_trip_seed import bootstrap_field_trip_defaults  # noqa: E402


def main():
    app = create_app()
    with app.app_context():
        result = bootstrap_field_trip_defaults()
        print(
            'Field-trip bootstrap complete: '
            f"created={result['created']} "
            f"backfilled={result['backfilled']} "
            f"totalClasses={result['totalClasses']}"
        )


if __name__ == '__main__':
    main()
