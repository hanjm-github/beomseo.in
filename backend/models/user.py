"""
User model for authentication.
"""
from datetime import datetime
from enum import Enum
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class UserRole(str, Enum):
    """User role enumeration following raw_plan.md priority system."""
    ADMIN = 'admin'                   # Full access
    STUDENT_COUNCIL = 'student_council'  # Student council board access
    TEACHER = 'teacher'               # Bold name display, otherwise same as student
    STUDENT = 'student'               # Default role, basic access


class User(db.Model):
    """User model for authentication and authorization."""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    nickname = db.Column(db.String(50), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(
        db.Enum(UserRole),
        default=UserRole.STUDENT,
        nullable=False
    )
    ip_address = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    def __repr__(self):
        return f'<User {self.nickname}>'
    
    def to_dict(self):
        """
        Convert user to API-safe response shape.

        Field names are intentionally stable because multiple board serializers
        embed this payload contract.
        """
        return {
            'id': self.id,
            'nickname': self.nickname,
            'role': self.role.value,
            'is_teacher': self.role == UserRole.TEACHER,  # For bold display
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
