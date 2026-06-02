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
  - `GET /api/school-info/meals/notifications/subscription?installationId=...`
  - `PUT /api/school-info/meals/notifications/subscription`
  - `DELETE /api/school-info/meals/notifications/subscription?installationId=...`

핵심 런타임 규칙:

1. 요청 경로는 MySQL에 저장된 급식 데이터만 읽습니다.
2. 실제 NEIS 호출은 동기화 스크립트에서만 수행합니다.
3. 급식 읽기/평점 요청은 브라우저별 익명 평점 쿠키를 공유합니다.
4. 평점 분포(`distribution`)는 `admin`에게만 내려주고, 일반/비로그인 응답은 빈 배열을 반환합니다.
5. 비공개 급식 의견은 로그인 사용자만 제출할 수 있고, 목록 조회는 `admin | student_council`만 가능합니다.
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

## 비공개 급식 의견 전달함 계약

의견은 기존 `school_meal_comments` 테이블에 저장됩니다. HTTP 경로도 기존 연동 호환을 위해 `/comments`를 유지하지만, 제품 의미는 공개 댓글이 아니라 비공개 의견 전달함입니다.

주요 컬럼은 `id`, `meal_date`, `user_id`, `body`, `created_at`, `updated_at`, `deleted_at`, `ip_address`, `user_agent`입니다. `approval_status`, `approved_by_id`, `approved_at`은 DB 스키마 호환을 위해 남겨둔 unused legacy 컬럼이며, 공개 여부·조회 권한·화면 표시·승인 워크플로에 사용하지 않습니다.

### 모델 및 인덱스

- Flask 앱은 `backend/models/school_meal_comment.py` 모델을 등록해 기존 `db.create_all()` 개발 흐름과 같은 테이블 정의를 공유합니다.
- FastAPI 앱은 `backend/fastapi_app/models.py`의 순수 SQLAlchemy 모델로 같은 테이블을 읽고 씁니다.
- 기존 승인 관련 인덱스와 제약 조건은 DB 변경 없이 유지하지만 현재 기능의 조회 정책에는 사용하지 않습니다.
- soft delete는 `deleted_at`으로 표현합니다.

### 조회

`GET /api/school-info/meals/{meal_date}/comments?page=1&pageSize=50&order=asc`

권한:

- `admin | student_council`
- 비로그인 사용자와 일반 학생은 목록을 조회할 수 없습니다.
- 기존 DB에 `approval_status=approved`인 행이 있어도 공개 댓글로 취급하지 않고, 학생회/관리자 전용 의견 목록에만 포함합니다.
- `deleted_at`이 있는 행은 제외합니다.
- `pageSize`는 최대 100이며, `order=asc|desc`는 생성 시각 기준으로 적용됩니다.

응답:

```json
{
  "items": [
    {
      "id": 1,
      "mealDate": "2026-05-24",
      "body": "오늘 메뉴 좋아요.",
      "author": { "id": 7, "name": "학생", "role": "student" },
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
- 제출된 의견은 외부에 공개되지 않고 학생회와 관리자만 확인합니다.
- 실제 급식 row가 없는 날짜는 `404`입니다.
- 의견 본문은 공백 제거 후 최대 1000자로 제한합니다.
- 서버는 요청의 `ip_address`, `user_agent`를 함께 저장하지만 클라이언트 응답에는 포함하지 않습니다.
- DB 기본값 때문에 신규 행의 `approval_status`는 남아 있을 수 있으나, 기능 의미상 승인 상태가 아닙니다.
- 승인 상태 변경 API는 제거되었습니다.

### 프론트엔드 표시 흐름

- 일반 사용자는 제출 폼과 완료 안내만 보고, 본인 제출 기록을 포함한 목록은 보지 않습니다.
- `admin | student_council`은 선택된 날짜가 바뀌거나 사용자 역할이 바뀌면 접수 의견 목록을 다시 조회합니다.
- `admin | student_council`이 직접 의견을 제출하면 화면은 반환된 의견을 현재 목록에 즉시 추가합니다.
- 저장된 급식이 없는 synthetic entry에서는 의견 조회와 제출을 비활성화합니다.
- 비로그인 사용자가 입력창이나 버튼을 누르면 로그인 화면으로 이동하며, 복귀 경로를 유지합니다.
- 승인/미승인 배지와 승인 토글은 표시하지 않습니다.

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
