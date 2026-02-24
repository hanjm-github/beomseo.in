# 백엔드 API 레퍼런스 (코드 기준 / 한국어)

이 문서는 `backend/routes`, `backend/models`, `backend/utils`, `backend/config.py`, `backend/app.py`를 기준으로 작성한 실행 계약 문서입니다.

## 1. 공통 규약

### 1.1 Base URL

- 개발 기본값: `http://127.0.0.1:5000`
- Health Check: `GET /api/health`

### 1.2 콘텐츠 타입

- 요청: `Content-Type: application/json` (파일 업로드 제외)
- 응답: JSON (`application/json`)

### 1.3 페이지네이션 공통 포맷

- 요청 쿼리:
  - `page` (기본 1)
  - `page_size` 또는 `pageSize` (동시 지원)
- 응답 키:
  - `items`, `total`, `page`, `page_size`, `pageSize`

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "page_size": 10,
  "pageSize": 10
}
```

### 1.4 인증 규약 (중요)

이 백엔드는 Bearer 헤더 중심 계약이 아닙니다. 표준 계약은 HttpOnly 쿠키 기반 JWT + CSRF 헤더입니다.

- Access Cookie: `access_token_cookie`
- Refresh Cookie: `refresh_token_cookie`
- CSRF Cookie: `csrf_access_token`, `csrf_refresh_token`
- CSRF Header: `X-CSRF-TOKEN`
- 관련 설정:
  - `JWT_TOKEN_LOCATION=['cookies']`
  - `JWT_COOKIE_CSRF_PROTECT=true` (기본)
  - `JWT_ACCESS_COOKIE_PATH=/`
  - `JWT_REFRESH_COOKIE_PATH=/api/auth`

클라이언트 요구사항:

1. `withCredentials: true`로 요청
2. 비안전 메서드(`POST/PUT/PATCH/DELETE`)에 `X-CSRF-TOKEN` 포함

### 1.5 권한 Role

- `admin`
- `student_council`
- `teacher`
- `student`

### 1.6 공통 상태 코드

| 코드 | 의미 | 대표 응답 |
|---|---|---|
| `200` | 조회/처리 성공 | `{...}` |
| `201` | 생성 성공 | `{...}` |
| `400` | 잘못된 요청 | `{"error":"..."}` |
| `401` | 인증 실패/누락 | `{"error":"...","error_code":"..."}` |
| `403` | 권한 부족/가시성 제한 | `{"error":"..."}` |
| `404` | 리소스 없음 | `{"error":"..."}` |
| `405` | 메서드 비허용 | `{"error":"..."}` |
| `409` | 중복/충돌 | `{"error":"..."}` |
| `422` | 유효성 검증 실패 | `{"error":"..."}` 또는 `{"errors":[...]}` |
| `429` | 레이트 리밋 초과 | `{"error":"...","error_code":"rate_limit_exceeded"}` |
| `500` | 서버 오류 | `{"error":"..."}` |

JWT 공통 에러 코드:

- `token_expired`
- `invalid_token`
- `authorization_required`
- `token_revoked`

### 1.7 캐시/레이트리밋 공통

- 캐시:
  - `@cache_json_response(namespace)` GET 응답 캐시
  - 쓰기 성공 시 `invalidate_cache_namespaces(...)`
- 레이트리밋 키:
  - 로그인 사용자: `user:<id>`
  - 익명: `ip:<remote>`
- 공통 쓰기 제한:
  - 블루프린트 단위 `POST/PUT/PATCH/DELETE`
- 인증 엔드포인트 별도 제한:
  - `register`, `login`, `refresh`

### 1.8 업로드 공통 계약

업로드 성공 응답:

```json
{
  "id": "stored-filename.ext",
  "name": "original.ext",
  "size": 12345,
  "url": "/api/.../uploads/stored-filename.ext?preview_token=...",
  "canonicalUrl": "/api/.../uploads/stored-filename.ext",
  "mime": "image/png",
  "kind": "image"
}
```

- `url`: 임시 미리보기 토큰이 포함될 수 있음
- `canonicalUrl`: DB/본문 저장에 사용하는 정규 URL
- DB 미연결 임시 파일은 `preview_token` 없이 접근 불가

## 2. 엔드포인트 인덱스

```mermaid
flowchart TD
    API["beomseo.in API"]
    API --> Health["/api/health"]
    API --> Auth["/api/auth/*"]
    API --> Notices["/api/notices/*"]
    API --> Free["/api/community/free/*"]
    API --> Club["/api/club-recruit/*"]
    API --> Subject["/api/subject-changes/*"]
    API --> Petition["/api/community/petitions/*"]
    API --> Survey["/api/surveys/*"]
    API --> Vote["/api/community/votes/*"]
    API --> Lost["/api/community/lost-found/*"]
    API --> Market["/api/community/gomsol-market/*"]

    Auth --> A1["register / login"]
    Auth --> A2["refresh / logout / me"]
    Notices --> N1["CRUD + comments"]
    Notices --> N2["reactions + uploads"]
    Free --> F1["CRUD + approve"]
    Free --> F2["bookmark + comments"]
    Survey --> S1["CRUD + responses"]
    Survey --> S2["credits / summary"]
```

- Health/Auth: `/api/health`, `/api/auth/*`
- Notices: `/api/notices/*`
- Free: `/api/community/free/*`
- Club Recruit: `/api/club-recruit/*`
- Subject Changes: `/api/subject-changes/*`
- Petitions: `/api/community/petitions/*`
- Surveys: `/api/surveys/*`
- Votes: `/api/community/votes/*`
- Lost & Found: `/api/community/lost-found/*`
- Gomsol Market: `/api/community/gomsol-market/*`

참고: 목록/생성/업로드 일부는 trailing slash(`.../`)도 허용합니다.

## 3. Health

### 3.1 `GET /api/health`

- 권한: 없음
- 성공 `200`:

```json
{
  "status": "healthy",
  "message": "범서고등학교 API 서버"
}
```

## 4. Auth API (`/api/auth`)

### 4.1 `POST /api/auth/register`

- 권한: 없음
- 레이트리밋: `RATELIMIT_REGISTER_LIMIT` (기본 `5 per 10 minute`)
- 정책:
  - `ALLOWED_SIGNUP_IPS` 대역에서만 가입 허용
  - 닉네임 금칙어(`NICKNAME_BANNED_WORDS`) 검사
- Body:
  - `nickname` string, 길이 `2~50`, 필수
  - `password` string, 길이 `10~72`, 필수
  - 비밀번호 강도: 대문자/소문자/숫자/특수문자 각 1개 이상
- 성공 `201`: `message + user`, 쿠키 발급
- 대표 실패:

```json
{
  "error": "이미 사용 중인 닉네임입니다."
}
```

### 4.2 `POST /api/auth/login`

- 권한: 없음
- 레이트리밋: `RATELIMIT_LOGIN_LIMIT` (기본 `5 per minute`)
- Body:
  - `nickname` string, 필수
  - `password` string, 필수
- 성공 `200`: `message + user`, 쿠키 발급
- 대표 실패:

```json
{
  "error": "닉네임 또는 비밀번호가 올바르지 않습니다."
}
```

### 4.3 `POST /api/auth/refresh`

- 권한: Refresh JWT 필요 (`@jwt_required(refresh=True)`)
- 레이트리밋: `RATELIMIT_REFRESH_LIMIT` (기본 `20 per 10 minute`)
- 성공 `200`:

```json
{
  "message": "토큰이 갱신되었습니다."
}
```

- 대표 실패:

```json
{
  "error": "Invalid refresh token"
}
```

### 4.4 `POST /api/auth/logout`

- 권한: Access JWT 필요
- Body: 없음
- 성공 `200`:

```json
{
  "message": "로그아웃 되었습니다."
}
```

### 4.5 `GET /api/auth/me`

- 권한: Access JWT 필요
- 성공 `200`:

```json
{
  "user": {
    "id": 1,
    "nickname": "user01",
    "role": "student",
    "is_teacher": false,
    "created_at": "2026-02-24T10:00:00"
  }
}
```

---
## 5. Notices API (`/api/notices`)

### 5.1 Enum/필드 규약

- `category`: `school | council`
- `reaction.type`: `like | dislike`
- 댓글 길이: `1~1000`
- 제목 길이: `2~200`
- 첨부 개수: 최대 `MAX_ATTACH_COUNT`(기본 5)

### 5.2 `GET /api/notices`

- 권한: 선택 인증
- 캐시: `notices`
- Query:
  - `category`: `school|council`
  - `query`: 제목/본문/요약/태그 검색
  - `pinned`, `important`, `exam`: boolean
  - `tags`: 콤마/개행/세미콜론 구분
  - `sort`: `recent|views|important`
  - `view`: `list`면 리스트 직렬화
  - `page`, `page_size|pageSize`

### 5.3 `POST /api/notices`

- 권한: `student_council | admin`
- Body:
  - `title` string `2~200`
  - `body` string 필수
  - `category` required (`school|council`)
  - `summary` optional
  - `pinned`, `important`, `examRelated` optional
  - `tags` optional
  - `attachments` array optional
- 실패 `422` 예시:

```json
{
  "errors": [
    "제목은 2~200자로 입력해주세요."
  ]
}
```

### 5.4 `GET /api/notices/{notice_id}`

- 권한: 선택 인증
- 성공: 상세 + `myReaction`
- 실패: `404`(없음/삭제)

### 5.5 `PUT /api/notices/{notice_id}`

- 권한: 작성 학생회 본인 또는 `admin`
- Body: 생성과 동일

### 5.6 `DELETE /api/notices/{notice_id}`

- 권한: 작성 학생회 본인 또는 `admin`
- 동작: 소프트 삭제

### 5.7 `POST /api/notices/uploads`

- 권한: `student_council | admin`
- Content-Type: `multipart/form-data`
- 필드: `file`
- 성공: 업로드 공통 계약

### 5.8 `GET /api/notices/uploads/{filename}`

- 권한: 선택 인증
- 정책:
  - 공지 첨부/본문 연결 파일은 접근 허용
  - 임시 파일은 `preview_token` 필수

### 5.9 `GET /api/notices/{notice_id}/comments`

- 권한: 선택 인증
- 캐시: `notices`
- Query: `order`, `page`, `page_size|pageSize`

### 5.10 `POST /api/notices/{notice_id}/comments`

- 권한: 인증 필요
- Body: `body` string `1~1000`

### 5.11 `DELETE /api/notices/{notice_id}/comments/{comment_id}`

- 권한: `admin`
- 동작: 소프트 삭제

### 5.12 `POST /api/notices/{notice_id}/reactions`

- 권한: 인증 필요
- Body: `{"type":"like"|"dislike"}`
- 동작: 같은 타입 재요청 시 토글 off, 다른 타입 시 전환

---

## 6. Free API (`/api/community/free`)

### 6.1 Enum/규약

- `category`: `chat|info|qna`
- `status`: `pending|approved`
- reaction: `like|dislike`
- 댓글 길이: `1~1000`

### 6.2 `GET /api/community/free`

- 권한: 선택 인증
- 캐시: `free`
- Query:
  - `category`, `query`
  - `sort`: `recent|comments|likes`
  - `mine` boolean
  - `bookmarked` boolean
  - `status` (`admin`에서만 의미)
  - `view`
  - `page`, `page_size|pageSize`
- 가시성:
  - 비로그인: 승인 글만
  - 일반 로그인: 승인 글 + 본인 pending
  - admin: 전체

### 6.3 `POST /api/community/free`

- 권한: 인증 필요
- Body:
  - `title` `2~200`
  - `body` required
  - `category` required (`chat|info|qna`)
  - `summary` optional
- 성공: `status=pending`

### 6.4 `GET /api/community/free/{post_id}`

- 권한: 선택 인증
- pending 가시성: admin/작성자만

### 6.5 `PUT /api/community/free/{post_id}`

- 권한: 작성자 또는 `admin`

### 6.6 `DELETE /api/community/free/{post_id}`

- 권한: `admin`
- 동작: 소프트 삭제

### 6.7 `POST /api/community/free/{post_id}/approve`

- 권한: `admin`

### 6.8 `POST /api/community/free/{post_id}/unapprove`

- 권한: `admin`

### 6.9 `POST /api/community/free/{post_id}/reactions`

- 권한: 인증 필요
- Body: `{"type":"like"|"dislike"}`

### 6.10 `POST /api/community/free/{post_id}/bookmark`

- 권한: 인증 필요
- 성공 예시:

```json
{
  "bookmarked": true,
  "bookmarkedCount": 3
}
```

### 6.11 `GET /api/community/free/{post_id}/comments`

- 권한: 선택 인증
- 캐시: `free`
- Query: `order`, `page`, `page_size|pageSize`

### 6.12 `POST /api/community/free/{post_id}/comments`

- 권한: 인증 필요
- Body: `body` `1~1000`

### 6.13 `DELETE /api/community/free/{post_id}/comments/{comment_id}`

- 권한: `admin`

### 6.14 `POST /api/community/free/uploads`

- 권한: 인증 필요
- 업로드: 파일/이미지 허용(`require_image=false`)

### 6.15 `GET /api/community/free/uploads/{filename}`

- 권한: 선택 인증
- pending 게시글 첨부는 admin/작성자만 접근
- 임시 파일은 `preview_token` 필요

---

## 7. Club Recruit API (`/api/club-recruit`)

### 7.1 Enum/규약

- `gradeGroup`: `lower|upper`
- `status`: `pending|approved`

### 7.2 `GET /api/club-recruit`

- 권한: 선택 인증
- 캐시: `club_recruit`
- Query:
  - `gradeGroup`
  - `q` 또는 `query`
  - `sort`: `recent|deadline`
  - `status` (`admin` 의미)
  - `view`
  - `page`, `page_size|pageSize`

### 7.3 `POST /api/club-recruit`

- 권한: 인증 필요
- Body:
  - `clubName` `1~120`
  - `field` `1~120`
  - `gradeGroup` (`lower|upper`)
  - `applyPeriod.start`(또는 `applyStart`) required
  - `applyPeriod.end` optional, 시작일 이후
  - `applyLink` optional, 길이 `<=500`, `http/https`
  - `extraNote` `1~200`
  - `body` optional `<=20000`
  - `posterUrl` optional

### 7.4 `GET /api/club-recruit/{item_id}`

- 권한: 선택 인증
- pending 가시성: admin/작성자만

### 7.5 `PUT /api/club-recruit/{item_id}`

- 권한: 작성자 또는 admin

### 7.6 `DELETE /api/club-recruit/{item_id}`

- 권한: `admin`

### 7.7 `POST /api/club-recruit/{item_id}/approve`

- 권한: `admin`

### 7.8 `POST /api/club-recruit/{item_id}/unapprove`

- 권한: `admin`

### 7.9 `POST /api/club-recruit/uploads`

- 권한: 인증 필요
- 업로드: 이미지 전용(`require_image=true`)

### 7.10 `GET /api/club-recruit/uploads/{filename}`

- 권한: 선택 인증
- 임시 파일은 `preview_token` 필요

---

## 8. Subject Changes API (`/api/subject-changes`)

### 8.1 Enum/규약

- `status`: `open|negotiating|matched`
- `approvalStatus`: `pending|approved`
- `contactLinks[].type`: `kakao|email|url|student_id|extra`
- 댓글 길이: `1~800`

### 8.2 `GET /api/subject-changes`

- 권한: 선택 인증
- 캐시: `subject_changes`
- Query:
  - `grade` (`1|2|3`)
  - `q` 또는 `query`
  - `subjectTag`
  - `onlyMine`, `hideClosed` boolean
  - `status` (`pending|approved`, admin 의미)
  - `view`
  - `page`, `page_size|pageSize`

### 8.3 `POST /api/subject-changes`

- 권한: 인증 필요
- Body:
  - `grade` (`1~3`)
  - `className` optional `<=20`
  - `offeringSubject` `2~120`
  - `requestingSubject` `2~120`
  - `note` optional `<=1000`
  - `contactLinks` array 최대 3
  - `status` optional
- 성공: `approvalStatus=pending`

### 8.4 `GET /api/subject-changes/{item_id}`

- 권한: 인증 필요 (`@jwt_required`)
- pending 가시성: admin/작성자만

### 8.5 `PUT /api/subject-changes/{item_id}`

- 권한: 작성자 또는 admin
- 작성자 수정 시 `approvalStatus`가 `pending`으로 리셋

### 8.6 `DELETE /api/subject-changes/{item_id}`

- 권한: 작성자 또는 admin

### 8.7 `POST /api/subject-changes/{item_id}/approve`

- 권한: `admin`

### 8.8 `POST /api/subject-changes/{item_id}/unapprove`

- 권한: `admin`

### 8.9 `POST /api/subject-changes/{item_id}/status`

- 권한: 작성자 또는 admin
- Body: `status=open|negotiating|matched`

### 8.10 `GET /api/subject-changes/{item_id}/comments`

- 권한: 인증 필요
- 캐시: `subject_changes`

### 8.11 `POST /api/subject-changes/{item_id}/comments`

- 권한: 인증 필요
- Body: `body` `1~800`

### 8.12 `DELETE /api/subject-changes/{item_id}/comments/{comment_id}`

- 권한: 댓글 작성자 또는 admin

---
## 9. Petitions API (`/api/community/petitions`)

### 9.1 Enum/규약

- `status`: `pending|approved|rejected`
- `statusDerived`: `needs-support|waiting-answer|answered`
- `category`는 고정 한글 enum(14개 부서 포함)

### 9.2 `GET /api/community/petitions`

- 권한: 선택 인증
- 캐시: `petitions`
- Query:
  - `view`
  - `status` (admin)
  - `approval` (`approved|unapproved|all`, admin)
  - `statusDerived`
  - `category`
  - `q`
  - `sort` (`recent|votes`)
  - `page`, `page_size|pageSize`
- 가시성:
  - 비로그인: 승인 글만
  - 로그인 일반: 승인 글 + 본인 글
  - admin: 전체 상태

### 9.3 `POST /api/community/petitions`

- 권한: 인증 필요
- Body:
  - `title` `2~200`
  - `summary` `1~200`
  - `body` required, `<=MAX_PETITION_BODY` (기본 10000)
  - `category` 고정 enum
- 성공: `status=pending`

### 9.4 `GET /api/community/petitions/{petition_id}`

- 권한: 선택 인증
- 캐시: `petitions`
- 승인 전: 작성자/admin만 조회 가능

### 9.5 `PUT /api/community/petitions/{petition_id}`

- 권한:
  - admin
  - 또는 작성자(현재 상태가 `pending|rejected`)

### 9.6 `DELETE /api/community/petitions/{petition_id}`

- 권한: `admin`

### 9.7 `POST /api/community/petitions/{petition_id}/approve`

- 권한: `admin`

### 9.8 `POST /api/community/petitions/{petition_id}/reject`

- 권한: `admin`

### 9.9 `POST /api/community/petitions/{petition_id}/vote`

- 권한: 인증 필요
- 조건: 승인된 청원만
- Body: `action=up|cancel` (기본 `up`)
- 성공 예시:

```json
{
  "votes": 34,
  "isVotedByMe": true,
  "status": "needs-support"
}
```

### 9.10 `POST /api/community/petitions/{petition_id}/answer`

- 권한: `admin | student_council`
- Body: `content` required
- 동작: 기존 답변 overwrite

---

## 10. Surveys API (`/api/surveys`)

### 10.1 Enum/크레딧 규약

- `approvalStatus`: `pending|approved`
- 파생 `status`: `open|closed`
- 크레딧 원장: `survey_credits`
  - `available = base + earned - used`
- 승인 보너스: `SURVEY_APPROVAL_GRANT` (기본 30)
- 응답 보상: 타인 설문 응답 시 `earned +5`

### 10.2 `GET /api/surveys`

- 권한: 선택 인증
- 캐시: `surveys`
- Query:
  - `view`
  - `status` (`pending|approved`, admin)
  - `q|query`
  - `sort`: `recent|quota-asc|responses-desc`
  - `mine=1`
  - `hide=1` (이미 응답한 설문 숨김)
  - `page`, `page_size|pageSize`

### 10.3 `GET /api/surveys/{survey_id}`

- 권한: 선택 인증
- 캐시: `surveys`
- 승인 전: owner/admin만

### 10.4 `POST /api/surveys`

- 권한: 인증 필요
- Body:
  - `title` `2~200`
  - `description` optional `<=1000`
  - `formJson`(또는 `form_json`) array 최소 1개
  - `expiresAt` optional

### 10.5 `PATCH /api/surveys/{survey_id}`

- 권한: 인증 필요
- 현재 동작: 항상 `405`

### 10.6 `POST /api/surveys/{survey_id}/approve`

- 권한: `admin`
- 동작: 승인 + 최초 1회 보너스 크레딧 지급

### 10.7 `POST /api/surveys/{survey_id}/unapprove`

- 권한: `admin`

### 10.8 `POST /api/surveys/{survey_id}/responses`

- 권한: 인증 필요
- 조건:
  - 설문 open
  - 중복 응답 불가
  - owner 크레딧 잔여 > 0
- Body: `answers` required
- 성공 예시:

```json
{
  "responseId": 100,
  "creditsEarned": 5,
  "creditsAvailable": 29,
  "responseQuota": 60,
  "responsesReceived": 1
}
```

### 10.9 `GET /api/surveys/{survey_id}/summary`

- 권한: owner/admin
- 캐시: `surveys`

### 10.10 `GET /api/surveys/{survey_id}/responses`

- 권한: owner/admin
- 캐시: `surveys`

### 10.11 `GET /api/surveys/credits/me`

- 권한: 인증 필요
- 캐시: `surveys` (TTL 20초)

---

## 11. Votes API (`/api/community/votes`)

### 11.1 규약

- 생성 권한: `admin | student_council`
- 옵션 개수: 최소 2, 최대 8 (기본값 기준)
- 투표 보상: `VOTE_REWARD_CREDITS` (기본 1)

### 11.2 `GET /api/community/votes`

- 권한: 선택 인증
- 캐시: `votes` (TTL 20)
- Query:
  - `view`
  - `sort`: `recent|participation|deadline`
  - `q`
  - `includeClosed` 또는 `closed`
  - `page`, `page_size|pageSize`

### 11.3 `GET /api/community/votes/{vote_id}`

- 권한: 선택 인증
- 캐시: `votes` (TTL 20)

### 11.4 `POST /api/community/votes`

- 권한: `admin | student_council`
- Body:
  - `title` `2~120`
  - `description` optional `<=1000`
  - `closesAt` optional, 현재보다 미래
  - `options` array (`id`, `text`)

### 11.5 `POST /api/community/votes/{vote_id}/vote`

- 권한: 인증 필요
- Body: `optionId` required
- 조건: open poll + 중복 투표 불가

---

## 12. Lost & Found API (`/api/community/lost-found`)

### 12.1 Enum/규약

- `status`: `searching|found`
- `category`: `electronics|clothing|bag|wallet_card|stationery|etc`
- 생성 시 이미지 최소 1개 필수

### 12.2 `GET /api/community/lost-found`

- 권한: 선택 인증
- 캐시: `lost_found`
- Query:
  - `status`
  - `category`
  - `q|query`
  - `sort`: `recent|foundAt-desc|foundAt-asc`
  - `view`
  - `page`, `page_size|pageSize`

### 12.3 `GET /api/community/lost-found/{post_id}`

- 권한: 없음

### 12.4 `POST /api/community/lost-found`

- 권한: `admin | student_council`
- Body:
  - `title` `2~120`
  - `description` `1~2000`
  - `status`, `category`
  - `foundAt` required
  - `foundLocation` `1~200`
  - `storageLocation` `1~200`
  - `images` 최소 1개

### 12.5 `POST /api/community/lost-found/{post_id}/status`

- 권한: `admin | student_council`
- Body: `status=searching|found`

### 12.6 `POST /api/community/lost-found/uploads`

- 권한: `admin | student_council`
- 업로드: 이미지 전용

### 12.7 `GET /api/community/lost-found/uploads/{filename}`

- 권한: 없음
- 임시 파일은 `preview_token` 필요

### 12.8 `GET /api/community/lost-found/{post_id}/comments`

- 권한: 없음
- 캐시: `lost_found`

### 12.9 `POST /api/community/lost-found/{post_id}/comments`

- 권한: 인증 필요
- Body: `body` `1~1000`

### 12.10 `DELETE /api/community/lost-found/{post_id}/comments/{comment_id}`

- 권한: `admin`

---

## 13. Gomsol Market API (`/api/community/gomsol-market`)

### 13.1 Enum/규약

- `category`: `books|electronics|fashion|hobby|ticket|etc`
- `status`: `selling|sold`
- `approvalStatus`: `pending|approved`

### 13.2 `GET /api/community/gomsol-market`

- 권한: 선택 인증
- 캐시: `gomsol_market`
- Query:
  - `status`
  - `category`
  - `approval` (`admin` 전용)
  - `q|query`
  - `sort`: `recent|price-asc|price-desc`
  - `view`
  - `page`, `page_size|pageSize`

### 13.3 `GET /api/community/gomsol-market/{post_id}`

- 권한: 인증 필요 (`@jwt_required`)
- pending 글은 admin/작성자만
- 동작: 조회 시 `views` 카운터 증가 (best-effort)

### 13.4 `POST /api/community/gomsol-market`

- 권한: 인증 필요
- Body:
  - `title` `2~120`
  - `description` `1~2000`
  - `price` 정수 `>=0`
  - `category`, `status`
  - `images` 최소 1개
  - `contact` (`studentId|openChatUrl|extra`) 중 최소 1개

### 13.5 `POST /api/community/gomsol-market/{post_id}/approve`

- 권한: `admin`

### 13.6 `POST /api/community/gomsol-market/{post_id}/unapprove`

- 권한: `admin`

### 13.7 `POST /api/community/gomsol-market/{post_id}/status`

- 권한: 작성자 또는 admin
- Body: `status=selling|sold`

### 13.8 `POST /api/community/gomsol-market/uploads`

- 권한: 인증 필요
- 업로드: 이미지 전용

### 13.9 `GET /api/community/gomsol-market/uploads/{filename}`

- 권한: 선택 인증
- 임시 파일은 `preview_token` 필요

---

## 14. 대표 오류 응답

### 14.1 인증 누락

```json
{
  "error": "인증이 필요합니다.",
  "error_code": "authorization_required"
}
```

### 14.2 토큰 만료

```json
{
  "error": "토큰이 만료되었습니다.",
  "error_code": "token_expired"
}
```

### 14.3 레이트리밋 초과

```json
{
  "error": "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
  "error_code": "rate_limit_exceeded",
  "retry_after": 10
}
```

### 14.4 유효성 오류(배열형)

```json
{
  "errors": [
    "category는 school 또는 council 이어야 합니다."
  ]
}
```

## 15. 검증 체크포인트

1. 엔드포인트 커버리지: `rg -n "route\(" backend/routes`
2. 인증 설정 정합성: `backend/config.py`의 JWT 쿠키/CSRF 설정
3. 페이지네이션 정합성: `backend/utils/pagination.py`
4. 업로드 토큰 정합성: `backend/utils/files.py`
5. 문서 계약은 Bearer 문구가 아닌 쿠키 JWT + CSRF 기준으로 유지
