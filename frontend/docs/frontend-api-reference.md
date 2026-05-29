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
- 스포츠리그 Base URL: `VITE_SPORTS_LEAGUE_API_URL` (미설정 시 `VITE_API_URL`로 fallback)
- 공통 클라이언트: `src/api/auth.js`의 Axios 인스턴스
- 스포츠리그 클라이언트: `src/api/sportsLeague.js`의 전용 `sportsApi` Axios 인스턴스
- 인증 채널: `withCredentials=true` (cookie 기반)
- CSRF 헤더: unsafe method에서 `X-CSRF-TOKEN` 자동 추가 (두 인스턴스 모두 동일)
- 수학여행 추가 CSRF 헤더: `X-Field-Trip-CSRF` (`field_trip_csrf_token` 쿠키와 쌍으로 사용)
- 날짜 문자열 정규화: timezone 없는 ISO 문자열에 `Z` 보정
- 인증 클라이언트 transport 실패: `app:network-request-failed` 이벤트 발행 → `NetworkStatusContext` → `OfflineGate`
- 공지 영역의 학교 소개(`src/pages/Notices/SchoolInfo/*`)는 백엔드 API를 호출하지 않고 정적 콘텐츠, 공식 출처 링크, 정적 SEO 정책만 사용합니다.

## 2. 모듈별 엔드포인트 요약

### 2.1 `src/api/auth.js` (`authApi`)

| 메서드 | HTTP/Endpoint | 입력 | 반환 | 오류 처리 | 사용 화면 |
|---|---|---|---|---|---|
| `register(nickname, password)` | `POST /api/auth/register` | 닉네임/비밀번호 | 사용자/세션 정보 | 아니오 | `SignUpPage`, `AuthContext` |
| `login(nickname, password)` | `POST /api/auth/login` | 닉네임/비밀번호 | 사용자/세션 정보 | 아니오 | `LoginPage`, `AuthContext` |
| `getMe()` | `GET /api/auth/me` | 없음 | 현재 사용자 정보 | 아니오 | 앱 초기화(`AuthContext`) |
| `logout()` | `POST /api/auth/logout` | 없음 | 로그아웃 결과 | 아니오 | Header, AuthContext |

보조 동작:

- 401 `token_expired` 시 `POST /api/auth/refresh` 후 원 요청 1회 재시도
- refresh 실패 시 `AUTH_EXPIRED_EVENT` 발생
- response가 오기 전 transport 수준에서 실패하면 `emitNetworkRequestFailure()`를 호출해 전역 오프라인 오버레이가 열릴 수 있습니다.

### 2.2 `src/api/notices.js` (`noticesApi`)

| 메서드 | HTTP/Endpoint | 핵심 입력 | 오류 처리 | 비고 |
|---|---|---|---|---|
| `getBudgetSettings()` | `GET /api/notices/budget/settings` | 없음 | 예 | 활성 회계연도 범위 + 기본 진입 월 |
| `list(params)` | `GET /api/notices` | `category`, `query`, `sort`, `page`, `pageSize`, `view=list`, `budgetYear?`, `budgetMonth?` | 예 | 페이지네이션 정규화 |
| `get(id)` | `GET /api/notices/:id` | `id` | 예 | 상세 조회 |
| `create(payload)` | `POST /api/notices` | 제목/본문/카테고리, `budgetYear?`, `budgetMonth?` | 예 | `post_created`/`post_create_failed` 트래킹 |
| `update(id, payload)` | `PUT /api/notices/:id` | `id`, 수정 payload, `budgetYear?`, `budgetMonth?` | 예 | 수정 |
| `remove(id)` | `DELETE /api/notices/:id` | `id` | 예 | 삭제 |
| `react(id, type)` | `POST /api/notices/:id/reactions` | 반응 타입 | 예 | 반응 처리 |
| `listComments(id, params)` | `GET /api/notices/:id/comments` | 페이지 파라미터 | 예 | 댓글 목록 |
| `createComment(id, body)` | `POST /api/notices/:id/comments` | 댓글 본문 | 예 | 댓글 작성 |
| `deleteComment(noticeId, commentId)` | `DELETE /api/notices/:noticeId/comments/:commentId` | 댓글 식별자 | 예 | 댓글 삭제 |
| `upload(file)` | `POST /api/notices/uploads` | multipart 파일 | 예 | 업로드 용량 제한 적용 |

공지/예산 공개 계약 요약:

- `getBudgetSettings()`는 `startYear`, `endYear`, `monthOrder`, `currentBudgetYear`, `currentBudgetMonth`, `defaultBudgetYear`, `defaultBudgetMonth`를 반환합니다.
- 예산 공개 루트(`/notices/budget`)는 위 settings 응답의 기본 연/월을 기준으로 월별 리스트 화면으로 이동합니다.
- `category='budget'`일 때는 `budgetYear`(회계연도 시작 연도)와 `budgetMonth`(03~02)를 함께 전달합니다.
- 예산 공개 상세 응답은 일반 notice 필드에 더해 `budgetYear`, `budgetMonth`를 포함할 수 있습니다.
- 예산 공개 글은 공지 API를 재사용하지만, 백엔드가 `pinned`, `important`, `examRelated`, `tags`를 비활성화해 응답합니다.
- 예산 공개 글 수정/삭제 권한은 `admin` 또는 원작성 `student_council` 기준으로 동작합니다.
- 댓글, 반응, 첨부 업로드는 기존 공지사항 계약을 그대로 재사용합니다.
- 오류 처리도 `category='budget'`, `budgetYear`, `budgetMonth` 필터를 지원합니다.
- 오류 처리의 settings 응답도 실제 `/budget/settings`와 같은 키 구조를 유지합니다.

### 2.3 `src/api/community.js` (`communityApi`, 자유게시판)

| 메서드 | HTTP/Endpoint | 오류 처리 | 권한/역할 포인트 |
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

### 2.3A `src/api/valuePick.js` (`valuePickApi`)

| 메서드 | HTTP/Endpoint | 오류 처리 | 비고 |
|---|---|---|---|
| `list` | `GET /api/community/value-pick` | 예 | 목록 |
| `get` | `GET /api/community/value-pick/:id` | 예 | 상세 |
| `create` | `POST /api/community/value-pick` | 예 | 생성 트래킹(`value_pick_board`) |
| `update` | `PUT /api/community/value-pick/:id` | 예 | 수정 |
| `approve` | `POST /api/community/value-pick/:id/approve` | 아니오 | 관리자 승인 |
| `unapprove` | `POST /api/community/value-pick/:id/unapprove` | 아니오 | 관리자 승인 해제 |
| `remove` | `DELETE /api/community/value-pick/:id` | 예 | 삭제 |
| `react` | `POST /api/community/value-pick/:id/reactions` | 예 | `like/dislike` 반응 |
| `listComments` | `GET /api/community/value-pick/:id/comments` | 예 | 댓글 목록 |
| `createComment` | `POST /api/community/value-pick/:id/comments` | 예 | 댓글 작성 |
| `deleteComment` | `DELETE /api/community/value-pick/:postId/comments/:commentId` | 예 | 댓글 삭제 |
| `upload` | `POST /api/community/value-pick/uploads` | 예 | 첨부 업로드 |

Value Pick 계약 요약:

- `competency + pledge + rich HTML body` 구조를 사용합니다.
- 목록 preview는 서버 또는 클라이언트가 HTML을 plain text로 축약한 `bodyPreview`를 사용합니다.
- 첨부 업로드 응답은 공통 upload contract를 따르며, 본문 저장 시 canonical URL 기준으로 연결됩니다.
- pending 글은 일반 사용자에게는 자신의 글만 보이고, admin은 전체를 볼 수 있습니다.

### 2.4 `src/api/clubRecruit.js` (`clubRecruitApi`)

| 메서드 | HTTP/Endpoint | 오류 처리 | 비고 |
|---|---|---|---|
| `list` | `GET /api/club-recruit` | 예 | 포스터 URL 절대경로 보정 |
| `get` | `GET /api/club-recruit/:id` | 예 | 상세 조회 |
| `create` | `POST /api/club-recruit` | 예 | 생성 트래킹 |
| `upload` | `POST /api/club-recruit/uploads` | 예 | 파일 업로드 |
| `approve` | `POST /api/club-recruit/:id/approve` | 아니오 | 승인 |
| `unapprove` | `POST /api/club-recruit/:id/unapprove` | 아니오 | 승인 해제 |

### 2.5 `src/api/subjectChanges.js` (`subjectChangesApi`)

| 메서드 | HTTP/Endpoint | 오류 처리 | 비고 |
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

| 메서드 | HTTP/Endpoint | 오류 처리 | 비고 |
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

| 메서드 | HTTP/Endpoint | 오류 처리 | 비고 |
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

| 메서드 | HTTP/Endpoint | 오류 처리 | 비고 |
|---|---|---|---|
| `list` | `GET /api/community/votes` | 예 | 옵션/득표율 정규화 |
| `detail` | `GET /api/community/votes/:id` | 예 | 상세 |
| `create` | `POST /api/community/votes` | 예 | 생성 트래킹 |
| `vote` | `POST /api/community/votes/:id/vote` | 예 | 투표 + 크레딧 정보 반환 |
| `canWrite(user)` | - | - | 작성 권한(`admin`, `student_council`) |

추가 export:

- `writerRoles`

### 2.8A `src/api/bospi.js` (`bospiApi`)

| 메서드 | HTTP/Endpoint | 오류 처리 | 비고 |
|---|---|---|---|
| `getState()` | `GET /api/community/bospi` | 아니오 | 기록, 비교 결과, 내 대기 예측, 내 점수, 랭킹, 관리 권한을 정규화 |
| `predict(direction)` | `POST /api/community/bospi/predictions` | 아니오 | `increase|decrease` 다음 지수 예측 생성/갱신 |
| `saveRecord(payload)` | `POST /api/community/bospi/records` | 아니오 | 학생 수 count payload를 전송하고 서버 계산 비율을 반영 |
| `canManage(user)` | - | - | `admin`, `student_council` 역할 확인 |

정규화 계약:

- `settings.rewardPoints`는 숫자로 보정하고 기본값은 `10`입니다.
- `records[]`는 `date`, `ratio`, `baselineStudentCount`, `uniformedStudentCount`, `createdAt`, `updatedAt` 중심으로 정규화합니다.
- `comparisons[]`는 날짜별 `outcome(increase|decrease|tie|null)`만 유지하며 이전 비교일/비율은 노출하지 않습니다.
- `myPrediction`은 날짜 없는 대기 예측이고, `myPredictions[]`는 기록 날짜로 확정된 평가 이력입니다.
- `rankings[]`는 `rank`, `totalScore`, `correctCount`, `incorrectCount`, `nextPrediction`, `isCurrentUser`를 포함합니다.

### 2.8B `src/api/studyWithBeomseo.js` (`studyWithBeomseoApi`)

| 메서드 | HTTP/Endpoint | 오류 처리 | 비고 |
|---|---|---|---|
| `getScoreboard()` | `GET /api/community/study-with-beomseo/scoreboard` | 아니오 | 30개 반 순위, 서버 시간, 공개 반영 시각, 관리 권한을 정규화 |
| `scheduleScoreUpdate(payload)` | `POST /api/community/study-with-beomseo/score-updates` | 아니오 | `classId`, 최종 `totalScore`, 공개 예정 `effectiveAt` 저장 |
| `canManage(user)` | - | - | `admin`, `student_council` 역할 확인 |

정규화 계약:

- `items[]`는 항상 `1-1`부터 `3-10`까지 30개 반을 포함합니다.
- 공개 시간이 지난 최신 점수만 일반 사용자 순위에 반영됩니다.
- `pendingUpdates[]`는 학생회 이상에게만 내려오는 미래 예약 목록입니다.
- `serverNow`, `updatedThrough`, `lastPublishedAt`, `effectiveAt`은 backend의 `+09:00` offset 포함 ISO 값을 사용합니다.
- `scheduleScoreUpdate()`는 점수 증감이 아니라 최종 총점 snapshot을 저장합니다.
- `classOptions`는 프론트가 즉시 렌더링할 수 있도록 `1-1`부터 `3-10`까지 고정 생성하며, backend의 `CLASS_OPTIONS`와 같은 범위를 전제로 합니다.
- 응답 정규화는 camelCase와 snake_case를 모두 허용합니다. `classId/class_id`, `totalScore/total_score`, `pendingUpdates/pending_updates`가 대표 예입니다.
- `canManage(user)`는 클라이언트 표시용 보조 판정이며, 실제 저장 권한은 `POST /score-updates`의 서버 권한 검사가 결정합니다.
- `StudyWithBeomseoPage`의 관리자 폼은 `datetime-local` 값을 학교 현지 시각으로 보고 `+09:00` offset을 붙여 전송합니다.
- 예약 목록 카운트다운은 `serverNow`를 초기 기준으로 삼고, 화면에서는 1초 간격으로 로컬 갱신합니다.

### 2.9 `src/api/lostFound.js` (`lostFoundApi`)

| 메서드 | HTTP/Endpoint | 오류 처리 | 비고 |
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

| 메서드 | HTTP/Endpoint | 오류 처리 | 비고 |
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

| 메서드 | HTTP/Endpoint | 오류 처리 | 비고 |
|---|---|---|---|
| `getCategories()` | `GET /api/sports-league/categories` | 예 | 스포츠리그 전환 UI용 카테고리 목록 |
| `getCategory(categoryId)` | `GET /api/sports-league/categories/:categoryId` | 예 | 캐시된 snapshot이 있으면 즉시 반환 후 백그라운드 refresh |
| `getPlayers(categoryId)` | `GET /api/sports-league/categories/:categoryId/players` | 예 | 선수 라인업/개인 순위용 별도 읽기 계약 |
| `createPlayer(categoryId, teamId, payload)` | `POST /api/sports-league/categories/:categoryId/teams/:teamId/players` | 예 | 학생회/admin만 선수 추가 |
| `deletePlayer(categoryId, playerId)` | `DELETE /api/sports-league/categories/:categoryId/players/:playerId` | 예 | 학생회/admin만 선수 삭제 |
| `adjustPlayerStat(categoryId, playerId, payload)` | `PATCH /api/sports-league/categories/:categoryId/players/:playerId/stats` | 예 | `goals/assists`를 `delta=-1|1`로 조정 |
| `createEvent(categoryId, payload)` | `POST /api/sports-league/categories/:categoryId/events` | 예 | 운영진 이벤트 등록 |
| `updateEvent(categoryId, eventId, payload)` | `PATCH /api/sports-league/categories/:categoryId/events/:eventId` | 예 | 운영진 이벤트 수정 |
| `deleteEvent(categoryId, eventId)` | `DELETE /api/sports-league/categories/:categoryId/events/:eventId` | 예 | 운영진 이벤트 삭제 |
| `updateMatchParticipants(categoryId, matchId, payload)` | `PATCH /api/sports-league/categories/:categoryId/matches/:matchId/participants` | 예 | admin용 토너먼트 참가 팀 교체 |
| `subscribe(categoryId, listener)` | `GET /api/sports-league/categories/:categoryId/stream` | 예 | category별 단일 EventSource 공유 |

추가 export:

- `managerRoles`
- 클라이언트 동작:
  - `getCategories()`는 `defaultCategoryId`와 `items[]`를 반환하며, 스포츠리그 화면의 리그 선택 select를 구성합니다.
  - API 카테고리 목록을 불러오기 전에는 `SPORTS_LEAGUE_CATEGORY_OPTIONS`의 2학년/3학년 대체 목록을 먼저 사용합니다.
  - 리그 선택을 바꾸면 현재 `tab` 쿼리만 유지하고, 새 카테고리의 선택 경기는 snapshot 기준으로 다시 결정합니다.
  - category별 transport 상태를 공유해 여러 listener가 있어도 EventSource는 1개만 유지
  - `getCategory()`는 memory/`localStorage` 캐시를 먼저 읽고 stale-while-revalidate로 최신 snapshot을 다시 가져옴
  - category가 바뀌면 `useSportsLeagueLive()`가 이전 snapshot을 즉시 비워 다른 리그 데이터가 잠시 남아 보이지 않게 합니다.
  - 선수 라인업/개인 순위는 `getPlayers()`와 mutation 응답으로만 갱신되며, snapshot/SSE에는 포함되지 않음
  - `createPlayer()/deletePlayer()/adjustPlayerStat()`는 응답에 포함된 `players` 배열 전체로 로컬 store를 교체
  - `subscribe()`는 `BroadcastChannel` 우선, 미지원 브라우저에서는 `storage` 이벤트로 탭 간 동기화
  - SSE 오류 시 5초 polling + 3초 재연결을 시도
- 백엔드 계약 요약:
  - snapshot/SSE는 익명 조회 가능
  - `GET /api/sports-league/categories`는 seed registry 순서의 카테고리 요약을 반환하고, bootstrap된 row가 있으면 DB 값을 우선합니다.
  - 기본 카테고리는 `2026-spring-grade2-boys-soccer`이고, 이전 카테고리로 `2026-spring-grade3-boys-soccer`가 함께 노출됩니다.
  - 이벤트 `author` payload는 `{ nickname }`만 노출
  - backend는 active event를 최대 `250`개까지만 유지
  - 코드 기준 route-level limiter는 snapshot 조회(`60 per minute`)에만 직접 연결되어 있음
  - standings override 저장/삭제, bootstrap endpoint는 현재 프론트 API 모듈에 노출되지 않음
- 서버 분리:
  - `VITE_SPORTS_LEAGUE_API_URL` 환경변수로 FastAPI 서버 주소를 지정할 수 있음
  - 미설정 시 기존 `VITE_API_URL` (Flask 서버)로 fallback
  - 전용 `sportsApi` Axios 인스턴스가 CSRF 토큰을 자동 첨부하며, `auth.js`의 refresh interceptor는 공유하지 않음
- 이벤트 입력 시간:
  - `minute` 필드는 제거됨 — 입력 시점의 `createdAt` 서버 타임스탬프가 초 단위(HH:MM:SS)로 표시됨

선수 라인업/개인 순위 요청 바디 요약:

| 메서드 | 요청 바디 |
|---|---|
| `createPlayer(categoryId, teamId, payload)` | `{ "name": "홍길동" }` |
| `adjustPlayerStat(categoryId, playerId, payload)` | `{ "stat": "goals" \| "assists", "delta": -1 \| 1 }` |

선수 mutation 공통 응답 키:

| 키 | 설명 |
|---|---|
| `player` | 방금 생성/수정된 선수 (`deletePlayer`는 제외) |
| `players` | 정렬된 전체 선수 배열 |
| `updatedAt` | 전체 선수 배열 기준 최신 갱신 시각 |

### 2.12 `src/api/fieldTrip.js` (`fieldTripApi`)

| 메서드 | HTTP/Endpoint | 오류 처리 | 비고 |
|---|---|---|---|
| `listClasses()` | `GET /api/community/field-trip/classes` | 예 | 반 목록 조회, unlock 상태는 브라우저 세션과 병합 |
| `unlockClass(classId, password)` | `POST /api/community/field-trip/classes/:classId/unlock` | 예 | 성공 시 해당 반 unlock 상태를 `sessionStorage`에 저장 |
| `listPosts(classId)` | `GET /api/community/field-trip/classes/:classId/posts` | 예 | 반별 게시글 목록 |
| `getPost(classId, postId)` | `GET /api/community/field-trip/classes/:classId/posts/:postId` | 예 | 게시글 상세 |
| `createPost(classId, payload)` | `POST /api/community/field-trip/classes/:classId/posts` | 예 | 잠금 해제된 반에서 anonymous/로그인 모두 작성 가능, rich HTML 본문 저장 |
| `updatePost(classId, postId, payload)` | `PUT /api/community/field-trip/classes/:classId/posts/:postId` | 예 | 로그인 작성자 또는 운영진만 수정 가능 |
| `deletePost(classId, postId)` | `DELETE /api/community/field-trip/classes/:classId/posts/:postId` | 예 | 로그인 작성자 또는 운영진만 삭제 가능 |
| `upload(file)` | `POST /api/community/field-trip/uploads` | 예 | 첨부 업로드, 전역 업로드 제한 재사용, FastAPI base URL 보정 |
| `getScoreboard()` | `GET /api/community/field-trip/scoreboard` | 예 | 10개 반 총점 배열 |
| `adjustScore(classId, delta)` | `PATCH /api/community/field-trip/classes/:classId/score` | 예 | 학생회/관리자 전용 점수 `±5` 즉시 반영 |
| `updateClassPassword(classId, password)` | `PUT /api/community/field-trip/classes/:classId/password` | 예 | `admin` 전용 게시판 비밀번호 변경 |
| `updateBoardDescription(classId, boardDescription)` | `PUT /api/community/field-trip/classes/:classId/board-description` | 예 | `admin` 전용 게시판 설명 수정 |

추가 export:

- `MAX_ATTACHMENTS`
- `MAX_FILE_SIZE`
- `getFieldTripErrorMessage(error, fallbackMessage)`

프론트 계약 타입 요약:

- `FieldTripTab = 'mission' | 'scoreboard'`
- `FieldTripClassId = '1' | ... | '10'`
- `FieldTripAttachment = { id, name, size, url, mime, kind }`
- `FieldTripMissionPost = { id, classId, authorUserId, authorRole, nickname, title, body, attachments, createdAt, updatedAt }`
- `FieldTripClassSummary = { classId, label, isUnlocked, postCount, boardDescription }`
- `FieldTripScoreRow = { classId, label, totalScore }` (`0` ~ `10000`)
- `FieldTripScoreDeltaRequest = { delta: -5 | 5 }`
- `FieldTripPasswordUpdateRequest = { password: string }`
- `FieldTripBoardDescriptionUpdateRequest = { boardDescription: string }`

Field Trip 추가 계약 요약:

- anonymous 글은 `authorRole='anonymous'`, `authorUserId=0`으로 정규화합니다.
- 로그인 사용자가 `createPost()`에 `nickname`을 넣어도 UI는 계정 닉네임/역할 기준으로 표시합니다.
- `body`는 plain text가 아니라 rich HTML이며, preview/빈 값 검사는 `toPlainText()` 기준으로 수행합니다.
- `fastapiApi`의 기본 `X-CSRF-TOKEN` 외에 `fieldTripApi`는 `X-Field-Trip-CSRF`를 추가로 붙입니다.
- 첨부와 본문 이미지 URL은 `normalizeUploadResponse(..., FASTAPI_BASE_URL)`와 `toAbsoluteApiUrl()`를 통해 FastAPI origin으로 절대경로화됩니다.

### 2.13 `src/api/meals.js` (`mealsApi`)

| 메서드 | HTTP/Endpoint | 오류 처리 | 비고 |
|---|---|---|---|
| `getToday()` | `GET /api/school-info/meals/today` | 예 | 오늘 급식 단건 조회 |
| `listRange(fromDateKey, toDateKey)` | `GET /api/school-info/meals?from=...&to=...` | 예 | 범위 급식 조회, 주말/휴일 empty entry 포함 |
| `submitRating(dateKey, category, score)` | `POST /api/school-info/meals/:date/ratings` | 아니오 | 급식 평점 1~5점 저장 |

급식 계약 요약:

- `MealEntry = { id, date, status, service, serviceLabel, menuItems, previewText, note, isNoMeal, calorieText, caloriesKcal, originItems, nutritionItems, ratings, syncedAt }`
- `ratings = { taste: { averageScore, totalCount, myScore, distribution[] }, anticipation: { ...same } }`
- `previewText`는 계속 내려오지만, 급식 페이지 UI는 `menuItems` 전체 노출을 우선 사용합니다.
- `submitRating()` 정책:
  - `taste`: 오늘(KST) 급식만 저장 가능
  - `anticipation`: 오늘 또는 예정 급식만 저장 가능
  - 지난 급식 날짜는 두 항목 모두 `422`
- 실제 FastAPI 응답은 `items[]` / `item` wrapper를 가지지만, `mealsApi`는 화면 코드에 바로 쓰도록 entry 배열/객체만 반환합니다.

### 2.13A `src/api/mealNotifications.js` (`mealNotificationsApi`)

| 메서드 | HTTP/Endpoint | 오류 처리 | 비고 |
|---|---|---|---|
| `getSubscription(installationId)` | `GET /api/school-info/meals/notifications/subscription` | 예 | 기기별 구독 조회 |
| `saveSubscription(payload)` | `PUT /api/school-info/meals/notifications/subscription` | 예 | installationId 기준 upsert |
| `deleteSubscription(installationId)` | `DELETE /api/school-info/meals/notifications/subscription` | 예 | 기기 등록 해제 |

급식 알림 계약 요약:

- 구독은 로그인 계정이 아니라 `installationId` 기준으로 저장됩니다.
- `enabled=true`일 때는 `fcmToken`이 필요합니다.
- `notificationTime`은 `HH:MM` 형식이며 backend가 5분 단위로 정규화합니다.
- API 응답은 모두 `{ item }` wrapper를 사용하고, 클라이언트는 그 내부 객체만 반환합니다.

## 3. 공통 유틸리티 및 지원 모듈

### 3.1 `src/api/fastapiClient.js`

| Export | 역할 |
|---|---|
| `fastapiApi` | 스포츠리그/수학여행/급식용 FastAPI Axios 인스턴스 |
| `FASTAPI_BASE_URL` | `VITE_SPORTS_LEAGUE_API_URL` 또는 `VITE_API_URL` fallback |
| `readCookie(name)` | FastAPI 요청용 CSRF 쿠키 읽기 |

동작 메모:

- 비안전 메서드에서 `csrf_access_token`을 읽어 `X-CSRF-TOKEN`을 자동 첨부합니다.
- `auth.js`의 refresh interceptor는 공유하지 않으며, transport 실패만 `app:network-request-failed`로 전파합니다.

### 3.2 `src/api/normalizers.js`

| 함수 | 역할 |
|---|---|
| `toAbsoluteApiUrl(url)` | 상대 URL을 기본적으로 `VITE_API_URL` 기준으로 보정하되, field-trip 업로드 경로는 `FASTAPI_BASE_URL`로 분기 |
| `normalizePaginatedResponse(data, fallbackPageSize)` | 페이지네이션 응답 키 정규화 (`pageSize`/`page_size`) |
| `normalizeUploadResponse(data)` | 업로드 응답 URL 필드 절대경로 보정 |

## 4. 화면-API 연결 빠른 찾기

| 화면 그룹 | API 모듈 |
|---|---|
| `src/pages/Notices/*` | `noticesApi` |
| `src/pages/Notices/SchoolInfo/*` | 없음 (정적 학교 소개 콘텐츠 + 공식 출처 링크) |
| `src/pages/Community/FreeBoard/*` | `communityApi` |
| `src/pages/Community/ValuePick/*` | `valuePickApi` |
| `src/pages/Community/ClubRecruit/*` | `clubRecruitApi` |
| `src/pages/Community/Subjects/*` | `subjectChangesApi` |
| `src/pages/Community/Petition/*` | `petitionApi` |
| `src/pages/Community/SurveyExchange/*` | `surveyApi` |
| `src/pages/Community/Vote/*` | `voteApi` |
| `src/pages/Community/Bospi/BospiPage.jsx` | `bospiApi` |
| `src/pages/Community/StudyWithBeomseo/StudyWithBeomseoPage.jsx` | `studyWithBeomseoApi` |
| `src/pages/Notices/LostFound/*` | `lostFoundApi` |
| `src/pages/Community/GomsolMarket/*` | `gomsolMarketApi` |
| `src/pages/SchoolLifeInfo/Meal/MealPage.jsx` | `mealsApi`, `mealNotificationsApi` |
| `src/pages/SchoolLifeInfo/SportsLeagueCategory/SportsLeagueCategoryPage.jsx` | `sportsLeagueApi` |
| `src/context/AuthContext.jsx` | `authApi` |

## 5. 변경 시 동기화 규칙

- `src/api/*.js` 메서드/endpoint 변경 시 본 문서를 즉시 갱신합니다.
- 이벤트 연동 변경 시 [analytics-tracking.md](./analytics-tracking.md)도 함께 갱신합니다.
- 라우트 구조 변경 시 [frontend-code-map.md](./frontend-code-map.md)와 함께 확인합니다.


