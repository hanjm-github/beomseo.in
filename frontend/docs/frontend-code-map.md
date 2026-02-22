# Frontend Code Map

This document explains how the frontend is organized so new contributors can quickly find where behavior lives.

## 1. Bootstrap And App Shell

Runtime starts at `src/main.jsx`, which mounts `<App />` into `#root`.

`src/App.jsx` is the top-level orchestrator:
- wraps the app with `ThemeProvider` and `AuthProvider`
- mounts React Router routes
- lazy-loads major page groups (`/notices/*`, `/community/*`, etc.)
- applies global route fallback UI

`src/layout/AppLayout.jsx` provides global shell structure:
- skip-link for accessibility
- shared header/footer
- main content container for routed views

## 2. Shared Context Responsibilities

### `src/context/AuthContext.jsx`
- owns authenticated user state
- initializes session from persisted tokens
- provides `login`, `register`, `logout`, and `clearError`
- listens to `AUTH_EXPIRED_EVENT` from API layer and forces signed-out state

### `src/context/ThemeContext.jsx`
- owns light/dark theme state
- resolves initial theme from storage then system preference
- syncs selected theme to `data-theme` on `document.documentElement`

## 3. API Architecture

## 3.1 Core HTTP Client
`src/api/auth.js` exports the shared axios instance and auth endpoints.

Important behavior:
- request interceptor adds `Authorization` from `tokenStore`
- response interceptor normalizes UTC-like datetime strings
- `401 token_expired` triggers refresh-token flow
- refresh is serialized with a shared `refreshPromise` lock
- failed refresh clears tokens and emits `AUTH_EXPIRED_EVENT`

## 3.2 Feature APIs
Feature API modules (`src/api/*.js`) wrap backend contracts for:
- notices
- free board (`community`)
- club recruit
- subject changes
- petitions
- surveys
- votes
- lost-found
- gomsol-market

Each module keeps page code stable by exposing:
- list/detail/create/update/delete methods as needed
- normalized paginated responses via `src/api/normalizers.js`
- file upload helpers where supported

## 3.3 Mock Fallback Model
`src/api/mockPolicy.js` controls fallback behavior:
- mocks only in dev and only when `VITE_ENABLE_API_MOCKS=1`
- fallback only on transport failures (`!error.response`)

`src/api/mocks/*.mock.js` modules mirror backend response shapes so UI code does not branch on environment.

## 4. Security Boundaries

`src/security/htmlSanitizer.js`:
- sanitizes rich HTML before storage/rendering
- provides plaintext extraction helpers used for validation/summaries

`src/security/urlPolicy.js`:
- rejects dangerous schemes (`javascript:`, `data:`, etc.)
- validates external/chat/asset URL targets

`src/components/security/SafeHtml.jsx`:
- sanitizes incoming HTML and fallback HTML
- is the preferred render path for server/user-generated rich content

`src/security/tokenStore.js`:
- wraps localStorage token access with guarded read/write operations

## 5. Route Map By Feature

## 5.1 Notices
Routes live under `src/pages/NoticesPage/*`:
- `index.jsx`: tab-level routing + compose button permissions
- `ListView.jsx`: filter/search/sort/pagination orchestration
- `DetailView.jsx`: reactions, attachments, comments, edit/delete actions
- `ComposeView.jsx`: create/edit form, permission checks, draft persistence, upload flow

Supporting UI lives in `src/components/notices/*`.

## 5.2 Community Router
`src/pages/CommunityRouter.jsx` maps `/community/*` to feature subroutes.

Feature route groups:
- free board (`src/pages/FreeBoard/*`, `src/components/freeboard/*`)
- club recruit (`src/pages/ClubRecruit/*`, `src/components/clubRecruit/*`)
- subjects (`src/pages/Subjects/*`, `src/components/subjects/*`)
- petitions (`src/pages/Petition/*`, `src/components/petition/*`)
- survey exchange (`src/pages/SurveyExchange/*`, `src/components/survey/*`)
- votes (`src/pages/Vote/*`, `src/components/vote/*`)
- lost-found (`src/pages/LostFound/*`, `src/components/lostfound/*`)
- gomsol-market (`src/pages/GomsolMarket/*`, `src/components/gomsolmarket/*`)

## 5.3 Main, Auth, Info, Legal
- `src/pages/MainPage/*`: landing/dashboard composition
- `src/pages/LoginPage.jsx`, `src/pages/SignUpPage.jsx`: auth entry flow
- `src/pages/SchoolInfoPage.jsx`, `src/pages/GalleryPage.jsx`: informational routes
- `src/pages/PrivacyPolicyPage.jsx`, `src/pages/TermsOfServicePage.jsx`: legal pages

## 6. Backend API Linkage

Frontend API modules are aligned to backend contracts documented in:
- `../backend/docs/backend_api.md`
- `../backend/docs/backend_api_ko.md`

Typical mapping examples:
- `src/api/notices.js` ↔ `/api/notices*`
- `src/api/community.js` ↔ `/api/community/free*`
- `src/api/petition.js` ↔ `/api/community/petitions*`
- `src/api/survey.js` ↔ `/api/surveys*`
- `src/api/vote.js` ↔ `/api/community/votes*`

When backend response shape changes, update the corresponding `src/api/*` module first, then adjust page/component usage if needed.

## 7. Recommended Onboarding Reading Order

1. `src/main.jsx`
2. `src/App.jsx`
3. `src/layout/AppLayout.jsx`
4. `src/context/AuthContext.jsx`
5. `src/api/auth.js`
6. `src/security/htmlSanitizer.js` and `src/security/urlPolicy.js`
7. `src/pages/CommunityRouter.jsx`
8. One complete feature stack (for example Notices):
   - `src/pages/NoticesPage/index.jsx`
   - `src/pages/NoticesPage/ListView.jsx`
   - `src/pages/NoticesPage/DetailView.jsx`
   - `src/pages/NoticesPage/ComposeView.jsx`
   - `src/components/notices/*`
   - `src/api/notices.js`

This sequence gives a top-down view from app shell to a full vertical slice.
