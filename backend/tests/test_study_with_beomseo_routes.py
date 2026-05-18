"""
Route tests for Study With Beomseo leaderboard endpoints.
"""
from pathlib import Path
import sys
import unittest

from flask import Flask
from flask_jwt_extended import JWTManager, create_access_token


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from models import User, UserRole, db  # noqa: E402
from routes.study_with_beomseo import study_with_beomseo_bp  # noqa: E402


class StudyWithBeomseoRouteTest(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.config.update(
            SQLALCHEMY_DATABASE_URI='sqlite:///:memory:',
            SQLALCHEMY_TRACK_MODIFICATIONS=False,
            JWT_SECRET_KEY='test-secret-for-study-with-beomseo-routes',
            JWT_TOKEN_LOCATION=['headers'],
        )
        db.init_app(app)
        JWTManager(app)
        app.register_blueprint(study_with_beomseo_bp)

        self.app = app
        self.client = app.test_client()
        with app.app_context():
            db.create_all()
            user = User(
                nickname='student-council',
                password_hash='unused',
                role=UserRole.STUDENT_COUNCIL,
            )
            db.session.add(user)
            db.session.commit()
            self.manager_user_id = user.id
            self.manager_token = create_access_token(
                identity=str(user.id),
                additional_claims={'role': UserRole.STUDENT_COUNCIL.value},
            )

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    def auth_headers(self):
        return {'Authorization': f'Bearer {self.manager_token}'}

    def test_public_scoreboard_returns_30_classes(self):
        response = self.client.get('/api/community/study-with-beomseo/scoreboard')
        data = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertFalse(data['canManage'])
        self.assertEqual(len(data['items']), 30)
        self.assertEqual(data['items'][0]['classId'], '1-1')
        self.assertEqual(data['pendingUpdates'], [])

    def test_score_update_requires_authentication(self):
        response = self.client.post(
            '/api/community/study-with-beomseo/score-updates',
            json={
                'classId': '1-1',
                'totalScore': 10,
                'effectiveAt': '2099-05-19T22:00:00+09:00',
            },
        )

        self.assertEqual(response.status_code, 401)

    def test_manager_can_create_pending_score_update(self):
        create_response = self.client.post(
            '/api/community/study-with-beomseo/score-updates',
            json={
                'classId': '2-7',
                'totalScore': 1650,
                'effectiveAt': '2099-05-19T22:00:00+09:00',
            },
            headers=self.auth_headers(),
        )
        created = create_response.get_json()

        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(created['classId'], '2-7')
        self.assertEqual(created['totalScore'], 1650)
        self.assertEqual(created['createdBy']['id'], self.manager_user_id)

        scoreboard_response = self.client.get(
            '/api/community/study-with-beomseo/scoreboard',
            headers=self.auth_headers(),
        )
        scoreboard = scoreboard_response.get_json()

        self.assertTrue(scoreboard['canManage'])
        self.assertEqual(len(scoreboard['pendingUpdates']), 1)
        self.assertEqual(scoreboard['pendingUpdates'][0]['classId'], '2-7')


if __name__ == '__main__':
    unittest.main()
