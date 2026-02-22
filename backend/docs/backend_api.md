# 백엔드 API 레퍼런스 (Korean)

## 1. 개요
- 베이스 URL: `http://<host>:5000`
- 프레임워크: Flask + SQLAlchemy + JWT + Flask-Limiter + Flask-Caching
- 인증 방식: `Authorization: Bearer <access_token>`
- 공통 응답 패턴:
  - 성공: 리소스 JSON 또는 `{ message: ... }`
  - 실패: `{ error: ... }` 또는 `{ errors: [...] }`

## 2. 공통 보안/정책
- 인증 실패: `401`
- 권한 부족: `403`
- 유효성 실패: `422`
- 중복/충돌: `409`
- 서버 오류: `500`
- 쓰기 요청 레이트 리밋: 블루프린트 공통 제한(`POST/PUT/PATCH/DELETE`)

## 3. 헬스체크
| 메서드 | 경로 | 인증 | 설명 | 응답 |
|---|---|---|---|---|
| GET | `/api/health` | 불필요 | 서버 상태 확인 | `{ status, message }` |

## 4. Auth (`/api/auth`)
| 메서드 | 경로 | 인증 | 권한 | 설명 |
|---|---|---|---|---|
| POST | `/api/auth/register` | 불필요 | - | 회원가입 (IP 제한 적용) |
| POST | `/api/auth/login` | 불필요 | - | 닉네임/비밀번호 로그인 |
| POST | `/api/auth/refresh` | `refresh token` 필요 | - | 토큰 로테이션 기반 재발급 |
| POST | `/api/auth/logout` | 필요 | - | 현재 액세스 토큰(및 선택적 리프레시 토큰) 폐기 |
| GET | `/api/auth/me` | 필요 | - | 내 사용자 정보 조회 |

주요 요청 필드:
- `register/login`: `nickname`, `password`
- `refresh`: 헤더의 refresh JWT
- `logout`: 선택적으로 `{ refresh_token }`

## 5. Notices (`/api/notices`)
| 메서드 | 경로 | 인증 | 권한 | 설명 |
|---|---|---|---|---|
| GET | `/api/notices` | 선택 | - | 공지 목록 조회(필터/정렬/태그/페이지네이션) |
| POST | `/api/notices` | 필요 | `student_council` 또는 `admin` | 공지 생성 |
| GET | `/api/notices/<notice_id>` | 선택 | - | 공지 상세 조회 |
| PUT | `/api/notices/<notice_id>` | 필요 | 작성자(학생회) 또는 `admin` | 공지 수정 |
| DELETE | `/api/notices/<notice_id>` | 필요 | 작성자(학생회) 또는 `admin` | 공지 소프트 삭제 |
| POST | `/api/notices/uploads` | 필요 | `student_council` 또는 `admin` | 첨부파일 업로드 |
| GET | `/api/notices/uploads/<filename>` | 선택 | - | 첨부파일 서빙(임시 파일 fallback 포함) |
| GET | `/api/notices/<notice_id>/comments` | 선택 | - | 댓글 목록 |
| POST | `/api/notices/<notice_id>/comments` | 필요 | - | 댓글 생성 |
| DELETE | `/api/notices/<notice_id>/comments/<comment_id>` | 필요 | `admin` | 댓글 삭제 |
| POST | `/api/notices/<notice_id>/reactions` | 필요 | - | 좋아요/싫어요 토글 |

## 6. Free Board (`/api/community/free`)
| 메서드 | 경로 | 인증 | 권한 | 설명 |
|---|---|---|---|---|
| GET | `/api/community/free` | 선택 | - | 자유게시판 목록 |
| POST | `/api/community/free` | 필요 | - | 게시글 생성(승인 대기) |
| GET | `/api/community/free/<post_id>` | 선택 | - | 게시글 상세(미승인 접근 제한) |
| PUT | `/api/community/free/<post_id>` | 필요 | 작성자 또는 `admin` | 게시글 수정 |
| DELETE | `/api/community/free/<post_id>` | 필요 | `admin` | 게시글 삭제 |
| POST | `/api/community/free/<post_id>/approve` | 필요 | `admin` | 승인 |
| POST | `/api/community/free/<post_id>/unapprove` | 필요 | `admin` | 승인 취소 |
| POST | `/api/community/free/<post_id>/reactions` | 필요 | - | 반응 토글/전환 |
| POST | `/api/community/free/<post_id>/bookmark` | 필요 | - | 북마크 토글 |
| GET | `/api/community/free/<post_id>/comments` | 선택 | - | 댓글 목록 |
| POST | `/api/community/free/<post_id>/comments` | 필요 | - | 댓글 생성 |
| DELETE | `/api/community/free/<post_id>/comments/<comment_id>` | 필요 | `admin` | 댓글 삭제 |
| POST | `/api/community/free/uploads` | 필요 | - | 첨부 업로드 |
| GET | `/api/community/free/uploads/<filename>` | 선택 | - | 첨부 서빙(임시 파일 fallback 포함) |

## 7. Club Recruit (`/api/club-recruit`)
| 메서드 | 경로 | 인증 | 권한 | 설명 |
|---|---|---|---|---|
| GET | `/api/club-recruit` | 선택 | - | 모집글 목록 |
| POST | `/api/club-recruit` | 필요 | - | 모집글 생성(승인 대기) |
| GET | `/api/club-recruit/<item_id>` | 선택 | - | 상세 조회 |
| PUT | `/api/club-recruit/<item_id>` | 필요 | 작성자 또는 `admin` | 수정 |
| DELETE | `/api/club-recruit/<item_id>` | 필요 | `admin` | 삭제 |
| POST | `/api/club-recruit/<item_id>/approve` | 필요 | `admin` | 승인 |
| POST | `/api/club-recruit/<item_id>/unapprove` | 필요 | `admin` | 승인 취소 |
| POST | `/api/club-recruit/uploads` | 필요 | - | 포스터 업로드 |
| GET | `/api/club-recruit/uploads/<filename>` | 선택 | - | 포스터 서빙(임시 파일 fallback 포함) |

## 8. Subject Changes (`/api/subject-changes`)
| 메서드 | 경로 | 인증 | 권한 | 설명 |
|---|---|---|---|---|
| GET | `/api/subject-changes` | 선택 | - | 과목교환 목록 |
| POST | `/api/subject-changes` | 필요 | - | 과목교환 생성(승인 대기) |
| GET | `/api/subject-changes/<item_id>` | 필요 | - | 상세 조회(미승인 접근 제한) |
| PUT | `/api/subject-changes/<item_id>` | 필요 | 작성자 또는 `admin` | 수정(작성자 수정 시 승인 리셋) |
| DELETE | `/api/subject-changes/<item_id>` | 필요 | 작성자 또는 `admin` | 삭제 |
| POST | `/api/subject-changes/<item_id>/approve` | 필요 | `admin` | 승인 |
| POST | `/api/subject-changes/<item_id>/unapprove` | 필요 | `admin` | 승인 취소 |
| POST | `/api/subject-changes/<item_id>/status` | 필요 | 작성자 또는 `admin` | 매칭 상태 변경 |
| GET | `/api/subject-changes/<item_id>/comments` | 필요 | - | 댓글 목록 |
| POST | `/api/subject-changes/<item_id>/comments` | 필요 | - | 댓글 생성 |
| DELETE | `/api/subject-changes/<item_id>/comments/<comment_id>` | 필요 | 작성자 또는 `admin` | 댓글 삭제 |

## 9. Petitions (`/api/community/petitions`)
| 메서드 | 경로 | 인증 | 권한 | 설명 |
|---|---|---|---|---|
| GET | `/api/community/petitions` | 선택 | - | 청원 목록(관리자/일반 사용자 가시성 분기) |
| POST | `/api/community/petitions` | 필요 | - | 청원 생성(승인 대기) |
| GET | `/api/community/petitions/<petition_id>` | 선택 | - | 상세 조회(미승인 접근 제한) |
| PUT | `/api/community/petitions/<petition_id>` | 필요 | 작성자(대기/반려) 또는 `admin` | 수정 |
| DELETE | `/api/community/petitions/<petition_id>` | 필요 | `admin` | 삭제 |
| POST | `/api/community/petitions/<petition_id>/approve` | 필요 | `admin` | 승인 |
| POST | `/api/community/petitions/<petition_id>/reject` | 필요 | `admin` | 반려 |
| POST | `/api/community/petitions/<petition_id>/vote` | 필요 | - | 추천/추천취소 |
| POST | `/api/community/petitions/<petition_id>/answer` | 필요 | `admin` 또는 `student_council` | 답변 작성/수정 |

## 10. Surveys (`/api/surveys`)
| 메서드 | 경로 | 인증 | 권한 | 설명 |
|---|---|---|---|---|
| GET | `/api/surveys` | 선택 | - | 설문 목록(승인/응답 여부/쿼터 기반 상태) |
| POST | `/api/surveys` | 필요 | - | 설문 생성(승인 대기) |
| GET | `/api/surveys/<survey_id>` | 선택 | - | 설문 상세(미승인 접근 제한) |
| PATCH | `/api/surveys/<survey_id>` | 필요 | - | 수정 비활성화(현재 405 반환) |
| POST | `/api/surveys/<survey_id>/approve` | 필요 | `admin` | 승인 + 1회 쿼터 지급 |
| POST | `/api/surveys/<survey_id>/unapprove` | 필요 | `admin` | 승인 취소 |
| POST | `/api/surveys/<survey_id>/responses` | 필요 | - | 응답 제출 + 크레딧 정산 |
| GET | `/api/surveys/<survey_id>/summary` | 필요 | 소유자 또는 `admin` | 요약 통계 |
| GET | `/api/surveys/<survey_id>/responses` | 필요 | 소유자 또는 `admin` | 원본 응답 목록 |
| GET | `/api/surveys/credits/me` | 필요 | - | 내 크레딧 조회 |

## 11. Votes (`/api/community/votes`)
| 메서드 | 경로 | 인증 | 권한 | 설명 |
|---|---|---|---|---|
| GET | `/api/community/votes` | 선택 | - | 투표 목록 |
| POST | `/api/community/votes` | 필요 | `admin` 또는 `student_council` | 투표 생성 |
| GET | `/api/community/votes/<vote_id>` | 선택 | - | 투표 상세 |
| POST | `/api/community/votes/<vote_id>/vote` | 필요 | - | 투표 참여 + 크레딧 적립 |

## 12. Lost & Found (`/api/community/lost-found`)
| 메서드 | 경로 | 인증 | 권한 | 설명 |
|---|---|---|---|---|
| GET | `/api/community/lost-found` | 선택 | - | 분실물 목록 |
| POST | `/api/community/lost-found` | 필요 | `admin` 또는 `student_council` | 분실물 등록 |
| GET | `/api/community/lost-found/<post_id>` | 선택 | - | 상세 조회 |
| POST | `/api/community/lost-found/<post_id>/status` | 필요 | `admin` 또는 `student_council` | 상태 변경 |
| POST | `/api/community/lost-found/uploads` | 필요 | `admin` 또는 `student_council` | 이미지 업로드 |
| GET | `/api/community/lost-found/uploads/<filename>` | 선택 | - | 이미지 서빙(임시 파일 fallback 포함) |
| GET | `/api/community/lost-found/<post_id>/comments` | 선택 | - | 댓글 목록 |
| POST | `/api/community/lost-found/<post_id>/comments` | 필요 | - | 댓글 생성 |
| DELETE | `/api/community/lost-found/<post_id>/comments/<comment_id>` | 필요 | `admin` | 댓글 삭제 |

## 13. Gomsol Market (`/api/community/gomsol-market`)
| 메서드 | 경로 | 인증 | 권한 | 설명 |
|---|---|---|---|---|
| GET | `/api/community/gomsol-market` | 선택 | - | 장터 목록(승인 상태 가시성 분기) |
| POST | `/api/community/gomsol-market` | 필요 | - | 장터 글 등록(승인 대기) |
| GET | `/api/community/gomsol-market/<post_id>` | 필요 | 작성자/관리자 또는 승인글 | 상세 조회 |
| POST | `/api/community/gomsol-market/<post_id>/approve` | 필요 | `admin` | 승인 |
| POST | `/api/community/gomsol-market/<post_id>/unapprove` | 필요 | `admin` | 승인 취소 |
| POST | `/api/community/gomsol-market/<post_id>/status` | 필요 | 작성자 또는 `admin` | 판매상태 변경 |
| POST | `/api/community/gomsol-market/uploads` | 필요 | - | 이미지 업로드 |
| GET | `/api/community/gomsol-market/uploads/<filename>` | 선택 | - | 이미지 서빙(권한/임시 fallback 포함) |

## 14. 운영 참고
- 캐시 무효화 네임스페이스:
  - notices, free, club_recruit, subject_changes, petitions, surveys, votes, lost_found, gomsol_market
- 토큰 폐기:
  - 로그아웃/리프레시 로테이션 시 `auth_tokens` 테이블 기반으로 서버 주도 폐기
