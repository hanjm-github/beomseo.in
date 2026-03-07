# Frontend Architecture

프론트엔드 아키텍처의 계층, 데이터 흐름, 인증/복구 전략, 보안 경계를 신규 기여자 관점에서 설명합니다.

## 문서 메타

| 항목 | 내용 |
|---|---|
| 대상 독자 | 신규 FE 개발자 |
| 소스 오브 트루스 | `src/App.jsx`, `src/layout/AppLayout.jsx`, `src/context/*`, `src/api/*`, `src/security/*` |
| 연계 문서 | [frontend-code-map.md](./frontend-code-map.md), [frontend-api-reference.md](./frontend-api-reference.md), [analytics-tracking.md](./analytics-tracking.md) |

## 1. 아키텍처 개요

```mermaid
flowchart TD
    A["Browser Entry: src/main.jsx"] --> B["App Boundary: src/App.jsx"]
    B --> C["Global Providers"]
    C --> C1["ThemeProvider"]
    C --> C2["AuthProvider"]
    B --> D["Router"]
    D --> E["AppLayout"]
    E --> E1["Header"]
    E --> E2["Route Page"]
    E --> E3["Footer"]
    E2 --> F["Feature Components"]
    F --> G["Feature API Module"]
    G --> H["Shared Axios Client: src/api/auth.js"]
    H --> I[("Backend API")]
    F --> J["Security Helpers"]
    J --> J1["urlPolicy"]
    J --> J2["htmlSanitizer"]
    J --> J3["csvSanitizer"]
    F --> K["Config: src/config/env.js"]
    F --> L["Utils: src/utils/roleDisplay.js"]
    F --> M["Analytics: src/analytics/zaraz.js"]
```

## 2. 계층별 책임

| 계층 | 핵심 파일 | 책임 | 비고 |
|---|---|---|---|
| Entry | `src/main.jsx` | React 앱 마운트 | StrictMode 적용 |
| App Boundary | `src/App.jsx` | Provider/Route/Suspense 조합 | 라우트 lazy-load |
| Layout | `src/layout/AppLayout.jsx` | 전역 UI 셸 | 접근성 skip-link 포함 |
| Context | `src/context/AuthContext.jsx`, `src/context/ThemeContext.jsx` | 인증/테마 전역 상태 | 페이지 공통 상태 제공 |
| Page | `src/pages/*` | 화면 단위 흐름 제어 | URL 상태와 API 호출 orchestration |
| Component | `src/components/*` | 표시 및 상호작용 UI | 기능별 재사용 컴포넌트 |
| API | `src/api/*` | 엔드포인트 호출, 정규화, fallback | UI와 백엔드 계약 분리 |
| Security | `src/security/*`, `src/components/security/SafeHtml.jsx` | 렌더링/링크/CSV 보안 경계 | 사용자 입력 신뢰 경계 |
| Analytics | `src/analytics/zaraz.js` | 이벤트 전송 래퍼/PII 차단 | host/환경 기반 게이팅 |
| Config | `src/config/env.js` | 환경변수 파싱/상수 노출 | 타입 보장, 기본값 처리 |
| Utils | `src/utils/roleDisplay.js` | 역할 정규화/표시 유틸리티 | 접두어/CSS 클래스 반환 |

## 3. 인증 토큰 갱신 흐름

`src/api/auth.js`의 Axios interceptor가 세션 복구를 담당합니다.

```mermaid
sequenceDiagram
    participant UI as Page/Component
    participant API as Axios Client
    participant BE as Backend

    UI->>API: 요청 전송
    API->>BE: HTTP Request(withCredentials)
    BE-->>API: 401 + error_code=token_expired
    API->>API: refreshPromise 단일화(lock)
    API->>BE: POST /api/auth/refresh (CSRF 포함)

    alt refresh 성공
        BE-->>API: 200 + 새 쿠키
        API->>BE: 원 요청 재시도
        BE-->>API: 성공 응답
        API-->>UI: 정상 데이터 반환
    else refresh 실패
        BE-->>API: 401/오류
        API->>UI: AUTH_EXPIRED_EVENT(auth:expired) dispatch
        API-->>UI: 오류 반환
    end
```

핵심 설계 포인트:

- `refreshPromise`로 동시 401 폭주를 1회 refresh 요청으로 수렴
- login/register/refresh 자체 요청은 재귀 refresh 대상에서 제외
- 초기 비로그인 `GET /api/auth/me` 실패는 글로벌 만료 경고로 확장하지 않음

## 4. Mock Fallback 흐름

mock fallback은 개발 환경의 네트워크 실패 복원용입니다.

```mermaid
flowchart TD
    A[Feature API call] --> B[Real API request]
    B --> C{에러 발생?}
    C -- 아니오 --> D[실제 응답 반환]
    C -- 예 --> E{fallback 조건 충족}
    E -- false --> F[오류 throw]
    E -- true --> G[동적 import src/api/mocks/*.mock.js]
    G --> H[Mock 응답 반환]
```

`shouldUseMockFallback(error)` 조건:

- `import.meta.env.DEV === true`
- `VITE_ENABLE_API_MOCKS === '1'`
- `!error.response` (transport/network 계열 실패)

## 5. 보안 경계와 데이터 신뢰 수준

| 경계 | 파일 | 방어 대상 |
|---|---|---|
| 외부 URL | `src/security/urlPolicy.js` | `javascript:`/`data:` 등 위험 scheme 차단, 허용 host 검증 |
| 리치 HTML | `src/security/htmlSanitizer.js` + `src/components/security/SafeHtml.jsx` | XSS/위험 태그/위험 속성 제거 |
| 설문 스키마 | `src/security/surveySchemaSanitizer.js` | third-party form schema의 link/src 필드 sanitize |
| CSV 내보내기 | `src/security/csvSanitizer.js` | Spreadsheet formula injection 완화 |
| 분석 payload | `src/analytics/zaraz.js` | 민감 키 차단(`email`, `token` 등), 이벤트 payload 정제 |

## 6. 라우팅 설계 원칙

- 최상위 라우트는 `src/App.jsx`에서만 정의
- 세부 기능 라우트는 기능별 라우터(`CommunityRouter`, `NoticesPage/index.jsx`, `SchoolInfo/index.jsx`)로 위임
- 페이지 컴포넌트는 가능한 한 API 호출 orchestration에 집중
- 표시 로직은 `src/components/*`로 분리

## 6.1 정적 템플릿 기반 화면 패턴

시간표 다운로드 화면은 백엔드 API 없이 번들된 정적 템플릿을 직접 소비합니다.

```mermaid
flowchart LR
    A["timetableTemplates.json"] --> B["TimetableDownloadPage"]
    B --> C["TimetableSvg"]
    C --> D["PNG Export (canvas)"]
```

핵심 포인트:

- 시간표 데이터는 `src/components/timetable/timetableTemplates.json`에서 직접 제공
- 하단 브랜딩 문구는 SVG 내부 텍스트로 직접 렌더링
- SVG 미리보기와 PNG 내보내기가 동일한 데이터 소스를 사용해 출력 일관성 유지

## 7. 기능 확장 규칙 (새 보드 추가 기준)

1. `src/pages/<Feature>/`에 `List/Detail/Compose` 라우트 화면 추가
2. `src/components/<feature>/`에 UI 컴포넌트 추가
3. `src/api/<feature>.js`에 API 모듈 추가 및 필요 시 mock 모듈 추가
4. `CommunityRouter` 또는 상위 라우트에 경로 연결
5. 필요 시 `trackPostCreated`/`trackPostCreateFailed` 연결
6. 문서 동기화
   - `frontend-code-map.md`
   - `frontend-api-reference.md`
   - `analytics-tracking.md`(이벤트 추가 시)

## 8. 운영 관점 체크 포인트

- 인증 만료 UX: `AUTH_EXPIRED_EVENT` 수신 시 로그인 유도 흐름 확인
- 환경 분리: 운영에서 mock fallback 비활성 유지
- 트래킹 품질: 허용 host/PII 차단 정책 검증
- 계약 안정성: API 응답 변경은 `src/api/*`에서 먼저 흡수 후 페이지 레이어에 반영

## 9. 커뮤니티 라우트 트리

`CommunityRouter`는 8개 보드를 각각 List/Detail/Compose 패턴으로 위임합니다.

```mermaid
graph LR
    CR["CommunityRouter"] --> FREE["free/*\n(List/Detail/Compose/Edit)"]
    CR --> CLUB["club-recruit/*\n(List/Detail/Compose)"]
    CR --> SUBJ["subjects/*\n(List/Detail/Compose)"]
    CR --> PET["petition/*\n(List/Detail/Compose)"]
    CR --> SUR["survey/*\n(List/Detail/Compose/Edit/Results)"]
    CR --> VOTE["vote/*\n(List/Detail/Compose)"]
    CR --> LF["lost-found/*\n(List/Detail/Compose)"]
    CR --> GM["gomsol-market/*\n(List/Detail/Compose)"]
```

`survey` 보드만 `/:id/edit`과 `/:id/results` 추가 라우트가 존재합니다.  
전체 경로 매핑은 [frontend-code-map.md §3.3](./frontend-code-map.md)을 참고합니다.

## 10. 스타일/디자인 토큰 계층

```mermaid
flowchart TD
    V["variables.css\n디자인 토큰 정의\n(색상/타이포/간격/그림자)"]
    V --> P["primitives.css\nHTML 요소 리셋 + 기본 타이포"]
    P --> G["globals.css\n유틸리티 클래스 + 공통 컴포넌트"]
    V --> L["layout.css\n레이아웃 그리드/컨테이너"]
    G --> CMP["Component-level CSS\n(각 컴포넌트 디렉터리)"]
    L --> CMP
```

- `variables.css`는 라이트/다크 테마를 `[data-theme]` 셀렉터로 분리하여 정의
- `ThemeContext`가 `document.documentElement.dataset.theme`을 전환하면 모든 토큰이 자동 반영

## 11. 역할(Role) 시스템

`src/utils/roleDisplay.js`의 역할 정규화 흐름:

```mermaid
flowchart LR
    INPUT["raw role string"] --> NORM["normalizeRole()"]
    NORM --> MAP{"ROLE_MAP 조회"}
    MAP -->|hit| OUT["prefix + className"]
    MAP -->|miss| ALIAS{"ROLE_ALIASES 조회"}
    ALIAS -->|hit| OUT
    ALIAS -->|miss| DEFAULT["student (기본값)"]
```

| 역할 | 접두어 | CSS 클래스 |
|---|---|---|
| `admin` | `[관리자]` | `role-admin` |
| `student_council` | `[학생회]` | `role-student-council` |
| `teacher` | `[교사]` | `role-teacher` |
| `student` | (없음) | `role-student` |

`getRoleDisplay()`는 `displayPrefix`, `ariaLabel`, `roleClassName`, `safeNickname`을 반환하며, `RoleName` 컴포넌트와 게시판 UI에서 공통으로 사용됩니다.
