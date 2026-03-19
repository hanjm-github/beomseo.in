"""
Apply one-off MySQL schema changes for field-trip ownership and board metadata.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

load_dotenv(BACKEND_DIR / '.env')
os.environ.setdefault('FLASK_ENV', 'development')

from config import Config  # noqa: E402


BOARD_DESCRIPTION_COLUMN = 'board_description'
AUTHOR_USER_ID_COLUMN = 'author_user_id'
AUTHOR_USER_ID_INDEX = 'ix_field_trip_posts_author_user_id'
AUTHOR_USER_ID_FK = 'fk_field_trip_posts_author_user_id'


def _has_column(inspector, table_name: str, column_name: str) -> bool:
    return any(column.get('name') == column_name for column in inspector.get_columns(table_name))


def _has_index(inspector, table_name: str, index_name: str) -> bool:
    return any(index.get('name') == index_name for index in inspector.get_indexes(table_name))


def _has_foreign_key(inspector, table_name: str, fk_name: str) -> bool:
    return any(foreign_key.get('name') == fk_name for foreign_key in inspector.get_foreign_keys(table_name))


def main():
    engine = create_engine(Config.SQLALCHEMY_DATABASE_URI)
    inspector = inspect(engine)

    if engine.dialect.name != 'mysql':
        raise RuntimeError(
            f'Unsupported database dialect for this migration: {engine.dialect.name}. '
            'This script is intended for MySQL environments.'
        )

    actions: list[str] = []

    with engine.begin() as connection:
        if not _has_column(inspector, 'field_trip_classes', BOARD_DESCRIPTION_COLUMN):
            connection.execute(
                text(
                    'ALTER TABLE field_trip_classes '
                    'ADD COLUMN board_description VARCHAR(240) NULL AFTER password_hash'
                )
            )
            actions.append('added field_trip_classes.board_description')

        if not _has_column(inspector, 'field_trip_posts', AUTHOR_USER_ID_COLUMN):
            connection.execute(
                text(
                    'ALTER TABLE field_trip_posts '
                    'ADD COLUMN author_user_id INT NULL AFTER class_id'
                )
            )
            actions.append('added field_trip_posts.author_user_id')

        inspector = inspect(connection)

        if not _has_index(inspector, 'field_trip_posts', AUTHOR_USER_ID_INDEX):
            connection.execute(
                text(
                    f'CREATE INDEX {AUTHOR_USER_ID_INDEX} '
                    'ON field_trip_posts (author_user_id)'
                )
            )
            actions.append(f'added index {AUTHOR_USER_ID_INDEX}')

        inspector = inspect(connection)

        if not _has_foreign_key(inspector, 'field_trip_posts', AUTHOR_USER_ID_FK):
            connection.execute(
                text(
                    'ALTER TABLE field_trip_posts '
                    f'ADD CONSTRAINT {AUTHOR_USER_ID_FK} '
                    'FOREIGN KEY (author_user_id) REFERENCES users(id) '
                    'ON DELETE SET NULL'
                )
            )
            actions.append(f'added foreign key {AUTHOR_USER_ID_FK}')

    print('Field-trip schema migration complete.')
    if actions:
        for action in actions:
            print(f' - {action}')
    else:
        print(' - no changes needed')


if __name__ == '__main__':
    main()
