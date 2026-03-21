# 급식 FastAPI 문서

## 개요

급식 기능은 FastAPI 서버가 담당합니다.

- 읽기 엔드포인트:
  - `GET /api/school-info/meals/today`
  - `GET /api/school-info/meals?from=YYYY-MM-DD&to=YYYY-MM-DD`
- 쓰기 엔드포인트:
  - `POST /api/school-info/meals/{meal_date}/ratings`
  - `GET /api/school-info/meals/notifications/subscription?installationId=...`
  - `PUT /api/school-info/meals/notifications/subscription`
  - `DELETE /api/school-info/meals/notifications/subscription?installationId=...`

핵심 런타임 규칙:

1. 요청 경로는 MySQL에 저장된 급식 데이터만 읽습니다.
2. 실제 NEIS 호출은 동기화 스크립트에서만 수행합니다.
3. 급식 읽기/평점 요청은 브라우저별 익명 평점 쿠키를 공유합니다.
4. 알림 구독은 사용자 계정이 아니라 `installationId` 기준의 기기 단위 레코드입니다.

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

## 급식 알림 구독 계약

알림 구독 API는 설치된 PWA 기기 단위로 동작합니다.

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
- `notificationTime`은 `HH:MM` 형식이어야 합니다.
- `timezone`은 유효한 IANA timezone이어야 합니다.
- installationId 기준으로 upsert합니다.

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
