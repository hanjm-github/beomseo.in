"""
School meal persistence model shared with the FastAPI meal reader.
"""
from __future__ import annotations

from datetime import datetime

from .user import db


MEAL_ID_TYPE = db.BigInteger().with_variant(db.Integer, 'sqlite')


class SchoolMeal(db.Model):
    __tablename__ = 'school_meals'

    id = db.Column(MEAL_ID_TYPE, primary_key=True, autoincrement=True)
    meal_date = db.Column(db.Date, nullable=False, index=True)
    meal_type_code = db.Column(db.String(4), nullable=False, default='2')
    meal_type_name = db.Column(db.String(32), nullable=False, default='중식')
    office_code = db.Column(db.String(16), nullable=False)
    office_name = db.Column(db.String(64), nullable=False)
    school_code = db.Column(db.String(16), nullable=False)
    school_name = db.Column(db.String(128), nullable=False)
    dish_html = db.Column(db.Text, nullable=False)
    menu_items_json = db.Column(db.Text, nullable=False, default='[]')
    preview_text = db.Column(db.String(255), nullable=False)
    note_text = db.Column(db.String(255), nullable=False)
    calorie_text = db.Column(db.String(64), nullable=True)
    calories_kcal = db.Column(db.Numeric(6, 1), nullable=True)
    origin_items_json = db.Column(db.Text, nullable=False, default='[]')
    nutrition_items_json = db.Column(db.Text, nullable=False, default='[]')
    meal_service_figure_raw = db.Column(db.Numeric(8, 1), nullable=True)
    source_from_ymd = db.Column(db.String(8), nullable=True)
    source_to_ymd = db.Column(db.String(8), nullable=True)
    source_load_ymd = db.Column(db.String(8), nullable=True)
    synced_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    __table_args__ = (
        db.UniqueConstraint('meal_date', 'meal_type_code', name='uq_school_meals_date_type'),
        db.Index('ix_school_meals_type_date', 'meal_type_code', 'meal_date'),
    )
