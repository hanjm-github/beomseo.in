"""
Lost & Found board models.
"""
from datetime import datetime
from enum import Enum

from .user import db


class LostFoundStatus(str, Enum):
    SEARCHING = 'searching'
    FOUND = 'found'


class LostFoundCategory(str, Enum):
    ELECTRONICS = 'electronics'
    CLOTHING = 'clothing'
    BAG = 'bag'
    WALLET_CARD = 'wallet_card'
    STATIONERY = 'stationery'
    ETC = 'etc'


class LostFoundPost(db.Model):
    """Lost-found entry with image gallery and lifecycle status."""
    __tablename__ = 'lost_found_posts'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text, nullable=False)
    status = db.Column(db.Enum(LostFoundStatus), nullable=False, default=LostFoundStatus.SEARCHING, index=True)
    category = db.Column(db.Enum(LostFoundCategory), nullable=False, default=LostFoundCategory.ETC, index=True)
    found_at = db.Column(db.DateTime, nullable=False, index=True)
    found_location = db.Column(db.String(200), nullable=False)
    storage_location = db.Column(db.String(200), nullable=False)
    views = db.Column(db.Integer, nullable=False, default=0)
    comments_count = db.Column(db.Integer, nullable=False, default=0)
    deleted_at = db.Column(db.DateTime, nullable=True, index=True)

    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    author_role = db.Column(db.String(50), nullable=False)
    author = db.relationship('User', foreign_keys=[author_id], backref=db.backref('lost_found_posts', lazy='dynamic'))

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    images = db.relationship(
        'LostFoundImage',
        backref='post',
        cascade='all, delete-orphan',
        lazy='selectin',
        order_by='LostFoundImage.display_order.asc(), LostFoundImage.id.asc()',
    )
    comments = db.relationship(
        'LostFoundComment',
        backref='post',
        cascade='all, delete-orphan',
        lazy='dynamic',
        order_by='LostFoundComment.created_at.asc()',
    )

    def to_dict(self):
        """Detail serializer used by lost-found detail endpoints."""
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'status': self.status.value if self.status else LostFoundStatus.SEARCHING.value,
            'category': self.category.value if self.category else LostFoundCategory.ETC.value,
            'images': [image.to_dict() for image in self.images],
            'foundAt': self.found_at.isoformat() if self.found_at else None,
            'foundLocation': self.found_location,
            'storageLocation': self.storage_location,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
            'views': self.views,
            'commentsCount': self.comments_count,
            'approvalStatus': 'approved',
            'author': {
                'id': self.author_id,
                'name': self.author.nickname if self.author else None,
                'role': self.author_role,
            },
        }

    def to_list_dict(self):
        """List serializer that returns preview image only."""
        images = [image.to_dict() for image in self.images]
        preview_images = images[:1]
        return {
            'id': self.id,
            'title': self.title,
            'status': self.status.value if self.status else LostFoundStatus.SEARCHING.value,
            'category': self.category.value if self.category else LostFoundCategory.ETC.value,
            'images': preview_images,
            'imageCount': len(images),
            'foundAt': self.found_at.isoformat() if self.found_at else None,
            'foundLocation': self.found_location,
            'storageLocation': self.storage_location,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
            'views': self.views,
            'commentsCount': self.comments_count,
            'approvalStatus': 'approved',
            'author': {
                'id': self.author_id,
                'name': self.author.nickname if self.author else None,
                'role': self.author_role,
            },
        }


class LostFoundImage(db.Model):
    __tablename__ = 'lost_found_images'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    post_id = db.Column(db.Integer, db.ForeignKey('lost_found_posts.id', ondelete='CASCADE'), nullable=False, index=True)
    name = db.Column(db.String(255), nullable=False)
    url = db.Column(db.String(500), nullable=False)
    mime = db.Column(db.String(128), nullable=True)
    size = db.Column(db.Integer, nullable=True)
    kind = db.Column(db.String(20), nullable=True)
    display_order = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        """Serialize lost-found image metadata."""
        return {
            'id': self.id,
            'name': self.name,
            'url': self.url,
            'mime': self.mime,
            'size': self.size,
            'kind': self.kind,
        }


class LostFoundComment(db.Model):
    __tablename__ = 'lost_found_comments'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    post_id = db.Column(db.Integer, db.ForeignKey('lost_found_posts.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    body = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at = db.Column(db.DateTime, nullable=True, index=True)

    user = db.relationship('User', backref=db.backref('lost_found_comments', lazy='dynamic'))

    def to_dict(self):
        """Serialize comment payload in frontend contract shape."""
        return {
            'id': self.id,
            'postId': self.post_id,
            'body': self.body,
            'author': {
                'id': self.user_id,
                'name': self.user.nickname if self.user else None,
                'role': self.user.role.value if self.user else None,
            },
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
        }
