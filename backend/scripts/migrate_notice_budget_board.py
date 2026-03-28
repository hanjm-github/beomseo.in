"""
Idempotent schema migration for the notice budget disclosure board.

Adds budget support to the existing notices table for environments that already
have an older schema and cannot rely on db.create_all() to alter columns.
"""
from pathlib import Path
import sys

from sqlalchemy import inspect, text

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import app  # noqa: E402
from models import db  # noqa: E402


INDEX_NAME = 'ix_notices_budget_list'
MYSQL_NOTICE_CATEGORY_ENUM = "ENUM('SCHOOL','COUNCIL','BUDGET')"


def ensure_budget_columns(connection):
    """Add budget_year and budget_month if they do not exist."""
    inspector = inspect(connection)
    existing_columns = {column['name'] for column in inspector.get_columns('notices')}

    # Older installations already have data in `notices`, so this script only
    # adds the nullable budget metadata needed by the new board.
    if 'budget_year' not in existing_columns:
        connection.execute(text('ALTER TABLE notices ADD COLUMN budget_year INT NULL'))
        print('Added notices.budget_year')

    if 'budget_month' not in existing_columns:
        connection.execute(text('ALTER TABLE notices ADD COLUMN budget_month INT NULL'))
        print('Added notices.budget_month')


def ensure_budget_enum(connection):
    """Extend MySQL/MariaDB notice category enum with BUDGET if needed."""
    if connection.dialect.name not in {'mysql', 'mariadb'}:
        print(f'Skipping enum migration for dialect={connection.dialect.name}')
        return

    row = connection.execute(text("SHOW COLUMNS FROM notices LIKE 'category'")).mappings().first()
    if not row:
        raise RuntimeError('notices.category column not found')

    category_type = str(row.get('Type') or row.get('type') or '')
    if 'BUDGET' in category_type.upper():
        print('Category enum already includes BUDGET')
        return

    connection.execute(
        text(f'ALTER TABLE notices MODIFY COLUMN category {MYSQL_NOTICE_CATEGORY_ENUM} NOT NULL')
    )
    print('Extended notices.category enum with BUDGET')


def ensure_budget_index(connection):
    """Create composite budget list index when it does not exist."""
    inspector = inspect(connection)
    existing_indexes = {index['name'] for index in inspector.get_indexes('notices')}
    if INDEX_NAME in existing_indexes:
        print(f'Index {INDEX_NAME} already exists')
        return

    # Budget listing filters by board type, cycle year, and month, so install
    # the same composite index the ORM now declares for fresh environments.
    connection.execute(
        text(
            f'CREATE INDEX {INDEX_NAME} '
            'ON notices (category, budget_year, budget_month, deleted_at, pinned, created_at)'
        )
    )
    print(f'Created index {INDEX_NAME}')


def main():
    with app.app_context():
        inspector = inspect(db.engine)
        if 'notices' not in inspector.get_table_names():
            print('notices table does not exist yet; nothing to migrate')
            return

        with db.engine.begin() as connection:
            ensure_budget_enum(connection)
            ensure_budget_columns(connection)
            ensure_budget_index(connection)

    print('Notice budget disclosure migration completed')


if __name__ == '__main__':
    main()
