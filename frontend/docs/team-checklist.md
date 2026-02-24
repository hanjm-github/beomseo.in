# Team Checklist (Frontend)

PR 전에 아래 항목을 체크해 문서/코드 정합성을 유지합니다.

## 1. 기능/코드 변경 기본 점검

- [ ] 변경 범위(페이지, 컴포넌트, API 모듈)를 PR 설명에 명확히 적었다.
- [ ] 로컬에서 최소 1회 `npm run build`를 실행해 빌드 가능 여부를 확인했다.
- [ ] 불필요한 콘솔 로그/디버깅 코드가 남아있지 않다.
- [ ] 역할 표시 로직(`src/utils/roleDisplay.js`) 변경 시 `docs/frontend-code-map.md`를 갱신했다.
- [ ] 환경변수 추가/변경 시 `README.md` 환경 변수 표와 `src/config/env.js`를 함께 갱신했다.

## 2. 라우트/화면 동기화 점검

- [ ] `src/App.jsx` 또는 `src/pages/CommunityRouter.jsx` 라우트 변경 시 `docs/frontend-code-map.md`를 갱신했다.
- [ ] 신규 화면 추가 시 "페이지 파일 -> 컴포넌트 -> API" 연결 정보를 문서에 반영했다.
- [ ] 레거시 wrapper 경로(`src/pages/NoticesPage.jsx`)를 깨지 않도록 import 경로를 확인했다.

## 3. API 동기화 점검

- [ ] `src/api/*.js` 메서드/엔드포인트를 변경했다면 `docs/frontend-api-reference.md`를 갱신했다.
- [ ] 백엔드 응답 형태 변경이 있는 경우 `src/api/normalizers.js` 영향 범위를 확인했다.
- [ ] mock fallback 로직(`src/api/mockPolicy.js`) 조건을 의도대로 유지했다.

## 4. Analytics/PII 점검

- [ ] 신규/변경 이벤트를 `docs/analytics-tracking.md`에 반영했다.
- [ ] payload에 `nickname`, `password`, `email`, `token`, `refresh_token`, `access_token`이 포함되지 않는다.
- [ ] 인증/게시글 생성 이벤트(`login`, `sign_up`, `post_created`, `post_create_failed`) 동작을 검증했다.

## 5. 보안 sanitize 점검

- [ ] 외부 링크/에셋 URL 처리 시 `src/security/urlPolicy.js` 정책을 준수한다.
- [ ] HTML 렌더링 경계에서 `src/components/security/SafeHtml.jsx` 또는 `sanitizeRichHtml`을 사용한다.
- [ ] CSV 다운로드/내보내기 로직이 있다면 `src/security/csvSanitizer.js`를 적용했다.

## 6. 문서 세트 갱신 점검

- [ ] `README.md` 문서 인덱스 링크가 최신 상태다.
- [ ] 아래 5개 핵심 문서 중 변경된 영역을 함께 업데이트했다.
  - [ ] `docs/frontend-code-map.md`
  - [ ] `docs/frontend-architecture.md`
  - [ ] `docs/frontend-api-reference.md`
  - [ ] `docs/analytics-tracking.md`
  - [ ] `docs/team-checklist.md`

## 7. 리뷰어 전달 메모

- [ ] 이번 PR에서 확인이 필요한 리스크(권한, 트래킹, 보안 sanitize)를 PR 본문에 명시했다.
- [ ] 테스트/검증 방법(재현 절차, 확인 URL, 기대 결과)을 PR 본문에 남겼다.
