# FastAPI 스포츠리그/수학여행 서버 배포 가이드

## 개요

FastAPI 서버는 Flask+uWSGI 메인 서버와 분리되어 **스포츠리그 문자중계**와 **수학여행 반 게시판/점수판**을 담당합니다.
기존 Flask 서버와 별도 포트/도메인에서 실행되며, **같은 MySQL DB와 JWT 쿠키 계약**을 공유합니다.

## 필수 요구사항

- Python 3.10+
- MySQL/MariaDB (기존 Flask 서버와 동일)
- Redis (선택사항, SSE pub/sub 최적화)

## 설치

```bash
cd backend
pip install -r requirements_fastapi.txt
```

## 환경변수

기존 `backend/.env` 파일을 공유합니다. 추가 설정이 필요하면 동일 파일에 추가하세요.

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL 연결 | `localhost:3306` |
| `JWT_SECRET_KEY` | JWT 시크릿 (Flask과 동일) | 필수 |
| `JWT_ACCESS_COOKIE_NAME` | 쿠키 이름 (Flask과 동일) | `access_token_cookie` |
| `CORS_ORIGINS` | 허용 Origin (쉼표 구분) | `http://localhost:5173` |
| `REDIS_URL` | Redis 주소 | `redis://localhost:6379/0` |
| `SPORTS_LEAGUE_SSE_HEARTBEAT_SECONDS` | SSE 하트비트 간격 | `15` |
| `FIELD_TRIP_UNLOCK_COOKIE_NAME` | 수학여행 잠금 해제 쿠키 이름 | `field_trip_unlock_token` |
| `FIELD_TRIP_CSRF_COOKIE_NAME` | 수학여행 쓰기용 CSRF 쿠키 이름 | `field_trip_csrf_token` |
| `FIELD_TRIP_CSRF_HEADER_NAME` | 수학여행 쓰기용 CSRF 헤더 이름 | `X-Field-Trip-CSRF` |
| `FIELD_TRIP_MAX_BODY_LENGTH` | 수학여행 리치 본문 최대 길이 | `6000` |

## 개발 실행

```bash
cd backend
python -m uvicorn fastapi_app.main:app --host 127.0.0.1 --port 8000 --reload
```

- `--reload`: 코드 변경 시 자동 재시작 (개발용)
- Swagger UI: `http://127.0.0.1:8000/docs`

## 운영 배포

### Uvicorn 직접 실행

```bash
cd backend
python -m uvicorn fastapi_app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 1 \
  --log-level info
```

> **workers=1 권장**: SSE 스트림의 in-process pub/sub는 단일 워커에서 작동합니다.
> Redis pub/sub를 사용하면 workers를 늘릴 수 있습니다.

### systemd 서비스

```ini
# /etc/systemd/system/fastapi-sports.service
[Unit]
Description=FastAPI Sports League Server
After=network.target mysql.service redis.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/path/to/backend
Environment=FLASK_ENV=production
ExecStart=/path/to/venv/bin/uvicorn fastapi_app.main:app --host 127.0.0.1 --port 8000 --workers 1
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable fastapi-sports
sudo systemctl start fastapi-sports
```

### Nginx 리버스 프록시

```nginx
upstream fastapi_sports {
    server 127.0.0.1:8000;
}

server {
    listen 443 ssl http2;
    server_name sports-api.beomseo.in;

    # SSL 설정 (생략)

    location / {
        proxy_pass http://fastapi_sports;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE 스트리밍을 위한 필수 설정
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;

        # Chunk transfer encoding 활성화
        chunked_transfer_encoding on;
    }
}
```

## 프론트엔드 설정

프론트엔드 `.env` 파일에 FastAPI 서버 주소를 추가합니다:

```bash
# 기존 Flask 백엔드 (변경 없음)
VITE_API_URL=https://api.beomseo.in

# FastAPI 스포츠리그 서버 (신규)
VITE_SPORTS_LEAGUE_API_URL=https://sports-api.beomseo.in
```

`VITE_SPORTS_LEAGUE_API_URL`을 설정하지 않으면 기존 Flask 서버로 fallback합니다.

## 동작 검증

```bash
# 헬스 체크
curl http://127.0.0.1:8000/api/health

# 스포츠리그 카테고리 스냅샷 조회
curl http://127.0.0.1:8000/api/sports-league/categories/2026-spring-grade3-boys-soccer

# SSE 스트림 테스트 (Ctrl+C로 종료)
curl -N http://127.0.0.1:8000/api/sports-league/categories/2026-spring-grade3-boys-soccer/stream

# 수학여행 반 목록 조회
curl http://127.0.0.1:8000/api/community/field-trip/classes
```

## 아키텍처

```
┌──────────────┐     ┌──────────────────┐
│  React SPA   │────▶│  Flask + uWSGI   │  ← 기존 (auth, notices, etc.)
│  Frontend    │     │  :5000           │
│              │     └──────────────────┘
│              │     ┌──────────────────┐
│              │────▶│  FastAPI+Uvicorn  │  ← 신규 (스포츠리그 + 수학여행)
└──────────────┘     │  :8000           │
                     └──────────────────┘
                             │
                     ┌───────┴───────┐
                     │  MySQL (공유)  │
                     └───────────────┘
```
