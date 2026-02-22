"""
Gomsol market (중고거래) models with approval workflow.
"""
from datetime import datetime
from enum import Enum

from .user import db


class GomsolMarketCategory(str, Enum):
    BOOKS = 'books'
    ELECTRONICS = 'electronics'
    FASHION = 'fashion'
    HOBBY = 'hobby'
    TICKET = 'ticket'
    ETC = 'etc'


class GomsolMarketSaleStatus(str, Enum):
    SELLING = 'selling'
    SOLD = 'sold'


class GomsolMarketApprovalStatus(str, Enum):
    PENDING = 'pending'
    APPROVED = 'approved'


class GomsolMarketPost(db.Model):
    __tablename__ = 'gomsol_market_posts'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text, nullable=False)
    price = db.Column(db.Integer, nullable=False, default=0)
    category = db.Column(db.Enum(GomsolMarketCategory), nullable=False, default=GomsolMarketCategory.ETC, index=True)
    status = db.Column(db.Enum(GomsolMarketSaleStatus), nullable=False, default=GomsolMarketSaleStatus.SELLING, index=True)
    approval_status = db.Column(
        db.Enum(GomsolMarketApprovalStatus),
        nullable=False,
        default=GomsolMarketApprovalStatus.PENDING,
        index=True,
    )

    contact_student_id = db.Column(db.String(50), nullable=True)
    contact_open_chat_url = db.Column(db.String(500), nullable=True)
    contact_extra = db.Column(db.String(500), nullable=True)

    views = db.Column(db.Integer, nullable=False, default=0)
    deleted_at = db.Column(db.DateTime, nullable=True, index=True)

    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    author_role = db.Column(db.String(50), nullable=False)
    author = db.relationship('User', foreign_keys=[author_id], backref=db.backref('gomsol_market_posts', lazy='dynamic'))

    approved_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    approved_by = db.relationship('User', foreign_keys=[approved_by_id])
    approved_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    images = db.relationship(
        'GomsolMarketImage',
        backref='post',
        cascade='all, delete-orphan',
        lazy='selectin',
        order_by='GomsolMarketImage.display_order.asc(), GomsolMarketImage.id.asc()',
    )

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'price': int(self.price or 0),
            'category': self.category.value if self.category else GomsolMarketCategory.ETC.value,
            'status': self.status.value if self.status else GomsolMarketSaleStatus.SELLING.value,
            'approvalStatus': self.approval_status.value if self.approval_status else GomsolMarketApprovalStatus.PENDING.value,
            'images': [image.to_dict() for image in self.images],
            'contact': {
                'studentId': self.contact_student_id or '',
                'openChatUrl': self.contact_open_chat_url or '',
                'extra': self.contact_extra or '',
            },
            'author': {
                'id': self.author_id,
                'name': self.author.nickname if self.author else None,
                'role': self.author_role,
            },
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
            'views': int(self.views or 0),
        }

    def to_list_dict(self):
        images = [image.to_dict() for image in self.images]
        return {
            'id': self.id,
            'title': self.title,
            'price': int(self.price or 0),
            'category': self.category.value if self.category else GomsolMarketCategory.ETC.value,
            'status': self.status.value if self.status else GomsolMarketSaleStatus.SELLING.value,
            'approvalStatus': self.approval_status.value if self.approval_status else GomsolMarketApprovalStatus.PENDING.value,
            'images': images[:1],
            'imageCount': len(images),
            'author': {
                'id': self.author_id,
                'name': self.author.nickname if self.author else None,
                'role': self.author_role,
            },
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
            'views': int(self.views or 0),
        }


class GomsolMarketImage(db.Model):
    __tablename__ = 'gomsol_market_images'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    post_id = db.Column(db.Integer, db.ForeignKey('gomsol_market_posts.id', ondelete='CASCADE'), nullable=False, index=True)
    name = db.Column(db.String(255), nullable=False)
    url = db.Column(db.String(500), nullable=False)
    mime = db.Column(db.String(128), nullable=True)
    size = db.Column(db.Integer, nullable=True)
    kind = db.Column(db.String(20), nullable=True)
    display_order = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'url': self.url,
            'size': self.size,
            'mime': self.mime,
            'kind': self.kind,
        }
