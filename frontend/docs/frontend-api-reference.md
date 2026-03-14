# Frontend API Reference

`src/api/*` 모듈의 프론트엔드 관점 API 계약 요약 문서입니다. 백엔드 상세 스키마는 [`../../backend/docs/backend_api.md`](../../backend/docs/backend_api.md)를 기준으로 합니다.

## 문서 메타

| 항목 | 내용 |
|---|---|
| 대상 독자 | FE 개발자 |
| 소스 오브 트루스 | `src/api/*.js` |
| 연계 문서 | [frontend-code-map.md](./frontend-code-map.md), [frontend-architecture.md](./frontend-architecture.md), [analytics-tracking.md](./analytics-tracking.md) |

## 1. 공통 규칙

- Base URL: `VITE_API_URL` (기본 `http://localhost:5000`)
- 공통 클라이언트: `src/api/auth.js`의 Axios 인스턴스
- 인증 채널: `withCredentials=true` (cookie 기반)
- CSRF 헤더: unsafe method에서 `X-CSRF-TOKEN` 자동 추가
- 날짜 문자열 정규화: timezone 없는 ISO 문자열에 `Z` 보정
- mock fallback: `src/api/mockPolicy.js` (`DEV + VITE_ENABLE_API_MOCKS=1 + !error.response`)

## 2. 모듈별 엔드포인트 요약

### 2.1 `src/api/auth.js` (`authApi`)

| 메서드 | HTTP/Endpoint | 입력 | 반환 | Mock fallback | 사용 화면 |
|---|---|---|---|---|---|
| `register(nickname, password)` | `POST /api/auth/register` | 닉네임/비밀번호 | 사용자/세션 정보 | 아니오 | `SignUpPage`, `AuthContext` |
| `login(nickname, password)` | `POST /api/auth/login` | 닉네임/비밀번호 | 사용자/세션 정보 | 아니오 | `LoginPage`, `AuthContext` |
| `getMe()` | `GET /api/auth/me` | 없음 | 현재 사용자 정보 | 아니오 | 앱 초기화(`AuthContext`) |
| `logout()` | `POST /api/auth/logout` | 없음 | 로그아웃 결과 | 아니오 | Header, AuthContext |

보조 동작:

- 401 `token_expired` 시 `POST /api/auth/refresh` 후 원 요청 1회 재시도
- refresh 실패 시 `AUTH_EXPIRED_EVENT` 발생

### 2.2 `src/api/notices.js` (`noticesApi`)

| 메서드 | HTTP/Endpoint | 핵심 입력 | Mock fallback | 비고 |
|---|---|---|---|---|
| `list(params)` | `GET /api/notices` | `category`, `query`, `sort`, `page`, `pageSize`, `view=list` | 예 | 페이지네이션 정규화 |
| `get(id)` | `GET /api/notices/:id` | `id` | 예 | 상세 조회 |
| `create(payload)` | `POST /api/notices` | 제목/본문/카테고리 등 | 예 | `post_created`/`post_create_failed` 트래킹 |
| `update(id, payload)` | `PUT /api/notices/:id` | `id`, 수정 payload | 예 | 수정 |
| `remove(id)` | `DELETE /api/notices/:id` | `id` | 예 | 삭제 |
| `react(id, type)` | `POST /api/notices/:id/reactions` | 반응 타입 | 예 | 반응 처리 |
| `listComments(id, params)` | `GET /api/notices/:id/comments` | 페이지 파라미터 | 예 | 댓글 목록 |
| `createComment(id, body)` | `POST /api/notices/:id/comments` | 댓글 본문 | 예 | 댓글 작성 |
| `deleteComment(noticeId, commentId)` | `DELETE /api/notices/:noticeId/comments/:commentId` | 댓글 식별자 | 예 | 댓글 삭제 |
| `upload(file)` | `POST /api/notices/uploads` | multipart 파일 | 예 | 업로드 용량 제한 적용 |

### 2.3 `src/api/community.js` (`communityApi`, 자유게시판)

| 메서드 | HTTP/Endpoint | Mock fallback | 권한/역할 포인트 |
|---|---|---|---|
| `list` | `GET /api/community/free` | 예 | 목록 조회 |
| `get` | `GET /api/community/free/:id` | 예 | 상세 조회 |
| `create` | `POST /api/community/free` | 예 | 생성 시 분석 이벤트 기록 |
| `update` | `PUT /api/community/free/:id` | 예 | 작성자/운영자 정책은 백엔드 계약 기준 |
| `approve` | `POST /api/community/free/:id/approve` | 아니오 | 관리자 승인 |
| `unapprove` | `POST /api/community/free/:id/unapprove` | 아니오 | 관리자 승인 해제 |
| `remove` | `DELETE /api/community/free/:id` | 예 | 삭제 |
| `react` | `POST /api/community/free/:id/reactions` | 예 | 반응 |
| `toggleBookmark` | `POST /api/community/free/:id/bookmark` | 예 | 북마크 |
| `listComments` | `GET /api/community/free/:id/comments` | 예 | 댓글 조회 |
| `createComment` | `POST /api/community/free/:id/comments` | 예 | 댓글 작성 |
| `deleteComment` | `DELETE /api/community/free/:postId/comments/:commentId` | 예 | 댓글 삭제 |
| `upload` | `POST /api/community/free/uploads` | 예 | 첨부 업로드 |

### 2.4 `src/api/clubRecruit.js` (`clubRecruitApi`)

| 메서드 | HTTP/Endpoint | Mock fallback | 비고 |
|---|---|---|---|
| `list` | `GET /api/club-recruit` | 예 | 포스터 URL 절대경로 보정 |
| `get` | `GET /api/club-recruit/:id` | 예 | 상세 조회 |
| `create` | `POST /api/club-recruit` | 예 | 생성 트래킹 |
| `upload` | `POST /api/club-recruit/uploads` | 예 | 파일 업로드 |
| `approve` | `POST /api/club-recruit/:id/approve` | 아니오 | 승인 |
| `unapprove` | `POST /api/club-recruit/:id/unapprove` | 아니오 | 승인 해제 |

### 2.5 `src/api/subjectChanges.js` (`subjectChangesApi`)

| 메서드 | HTTP/Endpoint | Mock fallback | 비고 |
|---|---|---|---|
| `list` | `GET /api/subject-changes` | 예 | 목록 |
| `get` | `GET /api/subject-changes/:id` | 예 | 상세 |
| `create` | `POST /api/subject-changes` | 예 | 생성 트래킹 |
| `approve` | `POST /api/subject-changes/:id/approve` | 아니오 | 승인 |
| `unapprove` | `POST /api/subject-changes/:id/unapprove` | 아니오 | 승인 해제 |
| `listComments` | `GET /api/subject-changes/:id/comments` | 아니오 | 댓글 목록 |
| `createComment` | `POST /api/subject-changes/:id/comments` | 아니오 | 댓글 작성 |
| `deleteComment` | `DELETE /api/subject-changes/:id/comments/:commentId` | 아니오 | 댓글 삭제 |
| `changeStatus` | `POST /api/subject-changes/:id/status` | 아니오 | 상태 변경 |

### 2.6 `src/api/petition.js` (`petitionApi`)

| 메서드 | HTTP/Endpoint | Mock fallback | 비고 |
|---|---|---|---|
| `list` | `GET /api/community/petitions` | 예 | 목록 |
| `detail` | `GET /api/community/petitions/:id` | 예 | 상세 |
| `create` | `POST /api/community/petitions` | 예 | 생성 트래킹 |
| `vote` | `POST /api/community/petitions/:id/vote` | 예 | 추천/비추천 |
| `answer` | `POST /api/community/petitions/:id/answer` | 예 | 답변 등록 |
| `approve` | `POST /api/community/petitions/:id/approve` | 예 | 승인 |
| `unapprove` | `POST /api/community/petitions/:id/reject` | 예 | 승인 해제 |

추가 export:

- `THRESHOLD_DEFAULT`
- `CATEGORY_OPTIONS`
- `deriveStatus(item)`

### 2.7 `src/api/survey.js` (`surveyApi`)

| 메서드 | HTTP/Endpoint | Mock fallback | 비고 |
|---|---|---|---|
| `list` | `GET /api/surveys` | 예 | `mine/hide/view=list` 지원 |
| `detail` | `GET /api/surveys/:id` | 예 | 상세 |
| `create` | `POST /api/surveys` | 예 | 생성 트래킹 |
| `update` | `PATCH /api/surveys/:id` | 예 | 수정 |
| `approve` | `POST /api/surveys/:id/approve` | 아니오 | 승인 |
| `unapprove` | `POST /api/surveys/:id/unapprove` | 아니오 | 승인 해제 |
| `submitResponse` | `POST /api/surveys/:id/responses` | 예 | 설문 응답 제출 |
| `summary` | `GET /api/surveys/:id/summary` | 예 | 요약 통계 |
| `rawResponses` | `GET /api/surveys/:id/responses?view=raw` | 예 | 원시 응답 |
| `credits` | `GET /api/surveys/credits/me` | 예 | 내 크레딧 조회 |

추가 export:

- `BASE_RESPONSE_QUOTA`
- `SURVEY_APPROVAL_GRANT`
- `computeStatus(survey)`

### 2.8 `src/api/vote.js` (`voteApi`)

| 메서드 | HTTP/Endpoint | Mock fallback | 비고 |
|---|---|---|---|
| `list` | `GET /api/community/votes` | 예 | 옵션/득표율 정규화 |
| `detail` | `GET /api/community/votes/:id` | 예 | 상세 |
| `create` | `POST /api/community/votes` | 예 | 생성 트래킹 |
| `vote` | `POST /api/community/votes/:id/vote` | 예 | 투표 + 크레딧 정보 반환 |
| `canWrite(user)` | - | - | 작성 권한(`admin`, `student_council`) |

추가 export:

- `writerRoles`

### 2.9 `src/api/lostFound.js` (`lostFoundApi`)

| 메서드 | HTTP/Endpoint | Mock fallback | 비고 |
|---|---|---|---|
| `list` | `GET /api/community/lost-found` | 예 | 목록 |
| `detail` | `GET /api/community/lost-found/:id` | 예 | 상세 |
| `create` | `POST /api/community/lost-found` | 예 | 생성 트래킹 |
| `updateStatus` | `POST /api/community/lost-found/:id/status` | 예 | 상태 변경 |
| `upload` | `POST /api/community/lost-found/uploads` | 예 | 이미지 업로드 |
| `listComments` | `GET /api/community/lost-found/:id/comments` | 예 | 댓글 목록 |
| `createComment` | `POST /api/community/lost-found/:id/comments` | 예 | 댓글 작성 |
| `deleteComment` | `DELETE /api/community/lost-found/:id/comments/:commentId` | 예 | 댓글 삭제 |
| `canWrite(user)` | - | - | 작성 권한(`admin`, `student_council`) |

추가 export:

- `LOST_FOUND_STATUS`
- `LOST_FOUND_CATEGORIES`
- `MAX_IMAGES`, `MAX_FILE_SIZE`

### 2.10 `src/api/gomsolMarket.js` (`gomsolMarketApi`)

| 메서드 | HTTP/Endpoint | Mock fallback | 비고 |
|---|---|---|---|
| `list` | `GET /api/community/gomsol-market` | 예 | 목록 |
| `detail` | `GET /api/community/gomsol-market/:id` | 예 | 상세 |
| `create` | `POST /api/community/gomsol-market` | 예 | 생성 트래킹 |
| `approve` | `POST /api/community/gomsol-market/:id/approve` | 예 | 관리자 승인 |
| `unapprove` | `POST /api/community/gomsol-market/:id/unapprove` | 예 | 관리자 승인 해제 |
| `updateStatus` | `POST /api/community/gomsol-market/:id/status` | 예 | 판매 상태 변경 |
| `upload` | `POST /api/community/gomsol-market/uploads` | 예 | 이미지 업로드 |
| `canWrite(user)` | - | - | 로그인 사용자 작성 가능 |
| `canManageApproval(user)` | - | - | `admin`만 승인 관리 |
| `canManageSaleStatus(user, post)` | - | - | `admin` 또는 작성자 |

추가 export:

- `statusLabel`, `approvalLabel`, `categoryLabel`
- `MAX_IMAGES`, `MAX_FILE_SIZE`

### 2.11 `src/api/sportsLeague.js` (`sportsLeagueApi`)

| 메서드 | HTTP/Endpoint | Mock fallback | 비고 |
|---|---|---|---|
| `getCategory(categoryId)` | `GET /api/sports-league/categories/:categoryId` | 예 | 캐시된 snapshot이 있으면 즉시 반환 후 백그라운드 refresh |
| `createEvent(categoryId, payload)` | `POST /api/sports-league/categories/:categoryId/events` | 예 | 운영진 이벤트 등록 |
| `updateEvent(categoryId, eventId, payload)` | `PATCH /api/sports-league/categories/:categoryId/events/:eventId` | 예 | 운영진 이벤트 수정 |
| `deleteEvent(categoryId, eventId)` | `DELETE /api/sports-league/categories/:categoryId/events/:eventId` | 예 | 운영진 이벤트 삭제 |
| `updateMatchParticipants(categoryId, matchId, payload)` | `PATCH /api/sports-league/categories/:categoryId/matches/:matchId/participants` | 예 | admin용 토너먼트 참가 팀 교체 |
| `subscribe(categoryId, listener)` | `GET /api/sports-league/categories/:categoryId/stream` | 예 | category별 단일 EventSource 공유 |

추가 export:

- `managerRoles`
- 클라이언트 동작:
  - category별 transport 상태를 공유해 여러 listener가 있어도 EventSource는 1개만 유지
  - `getCategory()`는 memory/`localStorage` 캐시를 먼저 읽고 stale-while-revalidate로 최신 snapshot을 다시 가져옴
  - `subscribe()`는 `BroadcastChannel` 우선, 미지원 브라우저에서는 `storage` 이벤트로 탭 간 동기화
  - SSE 오류 시 5초 polling + 3초 재연결을 시도
  - 개발 환경에서 transport 오류가 나고 `VITE_ENABLE_API_MOCKS=1`이면 category 단위로 mock transport로 전환
- 백엔드 계약 요약:
  - snapshot/SSE는 익명 조회 가능
  - 이벤트 `author` payload는 `{ nickname }`만 노출
  - backend는 active event를 최대 `250`개까지만 유지
  - 코드 기준 route-level limiter는 snapshot 조회(`60 per minute`)에만 직접 연결되어 있음
  - standings override 저장/삭제, bootstrap endpoint는 현재 프론트 API 모듈에 노출되지 않음

## 3. 공통 유틸리티 및 지원 모듈

### 3.1 `src/api/normalizers.js`

| 함수 | 역할 |
|---|---|
| `toAbsoluteApiUrl(url)` | 상대 URL을 `VITE_API_URL` 기준 절대 URL로 보정 |
| `normalizePaginatedResponse(data, fallbackPageSize)` | 페이지네이션 응답 키 정규화 (`pageSize`/`page_size`) |
| `normalizeUploadResponse(data)` | 업로드 응답 URL 필드 절대경로 보정 |

### 3.2 `src/api/mockPolicy.js`

| 항목 | 역할 |
|---|---|
| `ENABLE_API_MOCKS` | mock fallback 활성 조건 상수 |
| `shouldUseMockFallback(error)` | fallback 적용 여부 판별 |

### 3.3 `src/api/mockSurveyCreditStore.js`

설문 mock fallback에서 사용되는 인메모리 크레딧 저장소입니다.

| 항목 | 역할 |
|---|---|
| `getCreditBalance()` | 현재 mock 크레딧 잔액 조회 |
| `deductCredit()` | 응답 제출 시 크레딧 차감 |
| `grantCredit()` | 승인/보상 시 크레딧 추가 |

> 프로덕션 환경에서는 사용되지 않으며, `survey.mock.js`에서만 참조됩니다.

### 3.4 Mock 모듈 인벤토리

`src/api/mocks/` 디렉터리의 mock 파일과 대응 API 모듈:

| Mock 파일 | 대응 API 모듈 |
|---|---|
| `notices.mock.js` | `src/api/notices.js` |
| `community.mock.js` | `src/api/community.js` |
| `clubRecruit.mock.js` | `src/api/clubRecruit.js` |
| `subjectChanges.mock.js` | `src/api/subjectChanges.js` |
| `petition.mock.js` | `src/api/petition.js` |
| `survey.mock.js` | `src/api/survey.js` |
| `vote.mock.js` | `src/api/vote.js` |
| `lostFound.mock.js` | `src/api/lostFound.js` |
| `gomsolMarket.mock.js` | `src/api/gomsolMarket.js` |
| `sportsLeague.mock.js` | `src/api/sportsLeague.js` |

## 4. 화면-API 연결 빠른 찾기

| 화면 그룹 | API 모듈 |
|---|---|
| `pages/NoticesPage/*` | `noticesApi` |
| `pages/FreeBoard/*` | `communityApi` |
| `pages/ClubRecruit/*` | `clubRecruitApi` |
| `pages/Subjects/*` | `subjectChangesApi` |
| `pages/Petition/*` | `petitionApi` |
| `pages/SurveyExchange/*` | `surveyApi` |
| `pages/Vote/*` | `voteApi` |
| `pages/LostFound/*` | `lostFoundApi` |
| `pages/GomsolMarket/*` | `gomsolMarketApi` |
| `pages/SchoolInfo/SportsLeagueCategoryPage.jsx` | `sportsLeagueApi` |
| `context/AuthContext.jsx` | `authApi` |

## 5. 변경 시 동기화 규칙

- `src/api/*.js` 메서드/endpoint 변경 시 본 문서를 즉시 갱신합니다.
- 이벤트 연동 변경 시 [analytics-tracking.md](./analytics-tracking.md)도 함께 갱신합니다.
- 라우트 구조 변경 시 [frontend-code-map.md](./frontend-code-map.md)와 함께 확인합니다.
