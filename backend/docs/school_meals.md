# 급식 FastAPI 문서

## 개요

급식 기능은 FastAPI 서버가 담당합니다.

- 읽기 엔드포인트:
  - `GET /api/school-info/meals/today`
  - `GET /api/school-info/meals?from=YYYY-MM-DD&to=YYYY-MM-DD`
  - `GET /api/school-info/meals/{meal_date}/comments?page=1&pageSize=50&order=asc`
- 쓰기 엔드포인트:
  - `POST /api/school-info/meals/{meal_date}/ratings`
  - `POST /api/school-info/meals/{meal_date}/comments`
  - `PATCH /api/school-info/meals/{meal_date}/comments/{comment_id}/approval`
  - `GET /api/school-info/meals/notifications/subscription?installationId=...`
  - `PUT /api/school-info/meals/notifications/subscription`
  - `DELETE /api/school-info/meals/notifications/subscription?installationId=...`

핵심 런타임 규칙:

1. 요청 경로는 MySQL에 저장된 급식 데이터만 읽습니다.
2. 실제 NEIS 호출은 동기화 스크립트에서만 수행합니다.
3. 급식 읽기/평점 요청은 브라우저별 익명 평점 쿠키를 공유합니다.
4. 평점 분포(`distribution`)는 `admin`에게만 내려주고, 일반/비로그인 응답은 빈 배열을 반환합니다.
5. 댓글은 로그인 사용자만 작성할 수 있고, 새 댓글은 항상 승인 대기 상태로 저장됩니다.
6. 알림 구독은 사용자 계정이 아니라 `installationId` 기준의 기기 단위 레코드입니다.

## 응답 구조

각 급식 항목(`item`, `items[]`)은 아래 필드를 가집니다.

- `id`
- `date`
- `status`
- `service`
- `serviceLabel`
- `menuItems`
- `previewText`
- `note`
- `isNoMeal`
- `calorieText`
- `caloriesKcal`
- `originItems`
- `nutritionItems`
- `ratings`
- `syncedAt`

저장된 급식이 없는 날짜도 응답에서 빠지지 않습니다. 주말·휴일·미제공일은 `isNoMeal=true` synthetic entry로 채워지므로, 프론트는 달력 범위를 그대로 렌더링할 수 있습니다.

### `ratings` 구조

`ratings`는 `taste`, `anticipation` 두 카테고리를 모두 포함합니다.

- `averageScore`
- `totalCount`
- `myScore`
- `distribution[]`

`distribution[]`은 관리자 응답에서만 실제 버킷을 포함합니다. 비로그인/일반 사용자 응답은 평균(`averageScore`), 참여자 수(`totalCount`), 내 점수(`myScore`)만 포함하고 `distribution: []`을 반환합니다.

예시:

```json
{
  "taste": {
    "averageScore": 4.2,
    "totalCount": 12,
    "myScore": 5,
    "distribution": [
      { "score": 1, "count": 0, "ratio": 0 },
      { "score": 2, "count": 1, "ratio": 8 },
      { "score": 3, "count": 2, "ratio": 17 },
      { "score": 4, "count": 4, "ratio": 33 },
      { "score": 5, "count": 5, "ratio": 42 }
    ]
  },
  "anticipation": {
    "averageScore": null,
    "totalCount": 0,
    "myScore": null,
    "distribution": [
      { "score": 1, "count": 0, "ratio": 0 },
      { "score": 2, "count": 0, "ratio": 0 },
      { "score": 3, "count": 0, "ratio": 0 },
      { "score": 4, "count": 0, "ratio": 0 },
      { "score": 5, "count": 0, "ratio": 0 }
    ]
  }
}
```

## 익명 평점 쿠키 계약

급식 평점은 로그인 사용자와 비로그인 사용자 모두 사용할 수 있습니다.

- 쿠키 이름: `MEAL_RATING_COOKIE_NAME`
- 발급 시점:
  - `GET /today`
  - `GET /?from=...&to=...`
  - `POST /{meal_date}/ratings`
- 목적:
  - 비로그인 브라우저도 `meal_date + category` 조합마다 1개의 평점을 유지하기 위함
- 저장 방식:
  - 서버는 사용자 ID 또는 익명 쿠키 값을 직접 저장하지 않고, `JWT_SECRET_KEY`와 결합한 해시값(`viewer_key`)을 사용합니다.

즉, 브라우저를 바꾸면 다른 익명 사용자로 취급되고, 같은 브라우저에서는 재평가 시 기존 값이 overwrite됩니다.

## 평점 쓰기 계약

`POST /api/school-info/meals/{meal_date}/ratings`

요청 본문:

```json
{
  "category": "taste",
  "score": 4
}
```

- `category`: `taste | anticipation`
- `score`: `1 ~ 5`

정책:

- `taste`: 오늘(KST) 급식에만 허용
- `anticipation`: 오늘 또는 미래 급식에만 허용
- 과거 날짜는 `422`
- 실제 급식 row가 없는 날짜는 `404`

## 급식 댓글 계약

댓글은 `school_meal_comments` 테이블에 저장됩니다. 주요 컬럼은 `id`, `meal_date`, `user_id`, `body`, `approval_status`, `approved_by_id`, `approved_at`, `created_at`, `updated_at`, `deleted_at`, `ip_address`, `user_agent`입니다.

### 모델 및 인덱스

- Flask 앱은 `backend/models/school_meal_comment.py` 모델을 등록해 기존 `db.create_all()` 개발 흐름과 같은 테이블 정의를 공유합니다.
- FastAPI 앱은 `backend/fastapi_app/models.py`의 순수 SQLAlchemy 모델로 같은 테이블을 읽고 씁니다.
- `ix_school_meal_comments_date_status_created`는 날짜별 공개 목록과 관리자 목록 조회를 빠르게 하기 위한 인덱스입니다.
- `ix_school_meal_comments_date_user_status`는 로그인 사용자가 본인의 승인 대기 댓글을 함께 보는 조회 조건을 위한 인덱스입니다.
- `approval_status`는 `pending`, `approved`만 허용하며, soft delete는 `deleted_at`으로 표현합니다.

### 조회

`GET /api/school-info/meals/{meal_date}/comments?page=1&pageSize=50&order=asc`

공개 범위:

- 비로그인: 승인된 댓글만
- 로그인 일반 사용자: 승인된 댓글 + 본인이 쓴 승인 대기 댓글
- 관리자: 삭제되지 않은 모든 댓글

응답:

```json
{
  "items": [
    {
      "id": 1,
      "mealDate": "2026-05-24",
      "body": "오늘 메뉴 좋아요.",
      "approvalStatus": "pending",
      "author": { "id": 7, "name": "학생", "role": "student" },
      "approvedBy": null,
      "approvedAt": null,
      "createdAt": "2026-05-24T02:30:00Z",
      "updatedAt": "2026-05-24T02:30:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 50,
  "pageSize": 50
}
```

### 작성

`POST /api/school-info/meals/{meal_date}/comments`

요청 본문:

```json
{
  "body": "오늘 메뉴 좋아요."
}
```

정책:

- 로그인 사용자만 작성할 수 있습니다.
- 새 댓글은 관리자 작성분을 포함해 항상 `approval_status=pending`으로 생성됩니다.
- 실제 급식 row가 없는 날짜는 `404`입니다.
- 댓글 본문은 공백 제거 후 최대 1000자로 제한합니다.

### 승인 상태 변경

`PATCH /api/school-info/meals/{meal_date}/comments/{comment_id}/approval`

요청 본문:

```json
{
  "approved": true
}
```

정책:

- `admin`만 호출할 수 있습니다.
- `approved=true`면 `approval_status=approved`, `approved_by_id`, `approved_at`을 저장합니다.
- `approved=false`면 다시 `pending`으로 되돌리고 승인자 정보를 비웁니다.

### 프론트엔드 표시 흐름

- 급식 상세 화면은 선택된 날짜가 바뀌거나 로그인 사용자·역할이 바뀌면 댓글을 다시 조회합니다.
- 저장된 급식이 없는 synthetic entry에서는 댓글 조회와 작성을 비활성화합니다.
- 작성 성공 시 서버가 반환한 `pending` 댓글을 즉시 목록에 추가해 작성자가 본인 댓글을 바로 확인할 수 있습니다.
- 일반 사용자는 승인 대기 상태인 본인 댓글에만 `미승인` 배지를 봅니다.
- 관리자는 같은 목록에서 승인 토글을 사용해 `pending`과 `approved` 상태를 전환합니다.

## 급식 알림 구독 계약

알림 구독 API는 설치된 PWA 기기 단위로 동작합니다.

### 운영 요약

- 급식 알림 설정 UI는 프론트엔드 `오늘의 급식` 페이지에서만 노출됩니다.
- 설치된 PWA 기기별로 급식 알림 시간을 저장합니다.
- 실제 발송은 Firebase Web Push + FastAPI sender script 조합으로 동작합니다.
- 구독은 계정 단위가 아니라 `installationId` 기준 기기 단위 레코드로 저장됩니다.
- 알림 시각은 5분 단위(`HH:MM`)로 정규화됩니다.
- 잘못된 FCM 토큰은 sender가 자동 비활성화합니다.

### 조회

`GET /api/school-info/meals/notifications/subscription?installationId=...`

- `installationId`는 `1~64`자
- 응답은 `{ item: ... }` 형태이며, 구독이 없으면 `item`이 `null`일 수 있습니다.

### 저장/갱신

`PUT /api/school-info/meals/notifications/subscription`

요청 본문:

```json
{
  "installationId": "uuid-v4",
  "enabled": true,
  "notificationTime": "07:30",
  "timezone": "Asia/Seoul",
  "fcmToken": "fcm-registration-token"
}
```

규칙:

- `enabled=true`면 `fcmToken`이 필요합니다.
- `notificationTime`은 `HH:MM` 형식이어야 하며 5분 단위만 허용됩니다.
- `timezone`은 유효한 IANA timezone이어야 합니다.
- installationId 기준으로 upsert합니다.
- 같은 `fcmToken`이 다른 installationId에 이미 연결되어 있으면, 새 installationId가 토큰 소유권을 가져가고 이전 레코드는 비활성화됩니다.

### 삭제

`DELETE /api/school-info/meals/notifications/subscription?installationId=...`

- 설치 기기 단위 구독 레코드를 완전히 삭제합니다.

## 동기화 스크립트

수동 동기화:

```bash
cd backend
python scripts/sync_school_meals.py --year current
```

dry-run:

```bash
python scripts/sync_school_meals.py --year current --dry-run
```

알림 발송:

```bash
python scripts/send_school_meal_notifications.py
```

알림 발송 dry-run:

```bash
python scripts/send_school_meal_notifications.py --dry-run
```

sender 동작 메모:

- 현재 시각을 각 subscription의 timezone으로 변환해 `notificationTime`과 같은 minute-of-day인 기기만 선택합니다.
- 같은 로컬 날짜에 이미 발송한 subscription은 `last_sent_meal_date`로 한 번 더 걸러 중복 발송을 막습니다.
- payload는 `title`, `body`, `link`, `icon` 외에 `menuItemsJson`을 함께 포함해 foreground 알림도 여러 줄 메뉴를 복원할 수 있습니다.
- FCM이 `registration token not registered` 계열 오류를 돌려주면 sender가 해당 구독의 token을 지우고 `enabled=false`로 내려 다음 배치에서 재시도하지 않게 만듭니다.

cron 예시:

```cron
10 */6 * * * cd /path/to/repo/backend && /path/to/venv/bin/python scripts/sync_school_meals.py --year $(date +\%Y)
* * * * * cd /path/to/repo/backend && /path/to/venv/bin/python scripts/send_school_meal_notifications.py
```

## 데이터 소스

- 공식 엔드포인트: `https://open.neis.go.kr/hub/mealServiceDietInfo`
- 필터:
  - `.env`의 교육청 코드
  - `.env`의 학교 코드
  - 중식만 (`MMEAL_SC_CODE == "2"`)

## 알림 관련 환경변수

- `FIREBASE_SERVICE_ACCOUNT_PATH`
- `WEB_APP_ORIGIN`
