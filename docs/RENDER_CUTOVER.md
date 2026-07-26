# Render Cutover Runbook

Railway trial/credit 종료 후 Render로 되돌리기 위한 절차입니다.
현재 앱 fallback은 Render를 바라보며, 이 문서는 Render 설정을 다시 확인하거나 재전환할 때 따라 할 체크리스트입니다.

## 현재 상태

- Previous Railway backend: `https://love-alarm-production.up.railway.app`
- Backend health check: `/health`
- Render backend: `https://love-alarm-server.onrender.com`
- Render sleep 방지 로직: `backend/src/index.js` — `ENABLE_KEEP_ALIVE=1`일 때만 `RENDER_EXTERNAL_URL` self-ping (Free 기본 OFF)
- Render blueprint: `render.yaml`

## 전환 전 준비

1. Render에서 이 GitHub repo를 연결합니다.
2. Blueprint 또는 Web Service로 `render.yaml`을 사용합니다.
3. 서비스 이름은 기본값 `love-alarm-server`를 우선 사용합니다.
4. 서비스 URL이 달라지면 이후 문서의 `https://love-alarm-server.onrender.com`을 실제 URL로 바꿔 적용합니다.

## Render 환경변수

Railway에 있는 값을 그대로 복사합니다. 값 자체는 문서에 남기지 않습니다.

- `DATABASE_URL`
- `JWT_SECRET`
- `META_VERIFY_TOKEN`
- `INSTAGRAM_ACCESS_TOKEN`
- `INSTAGRAM_BUSINESS_ACCOUNT_ID`
- `TOSS_CLIENT_CERT_BASE64`
- `TOSS_CLIENT_KEY_BASE64`
- `TOSS_DECRYPTION_KEY`
- `TOSS_AAD`
- `LLM_PROVIDER`
- `GROQ_API_KEY`
- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `CORS_ORIGIN=*`

`RENDER_EXTERNAL_URL`이 Render에서 자동 주입되지 않으면 수동으로 추가합니다.
Free 플랜에서는 keep-alive를 켜지 마세요 (`ENABLE_KEEP_ALIVE=0`). 월 750h 소진 시 Suspend됩니다.

```text
RENDER_EXTERNAL_URL=https://love-alarm-server.onrender.com
ENABLE_KEEP_ALIVE=0
```

## 전환 확인 절차

1. Render 배포가 성공했는지 확인합니다.

```bash
curl -sf https://love-alarm-server.onrender.com/health
```

2. 프론트엔드 fallback이 Render URL인지 확인합니다.

```js
// frontend/src/utils/api.js
const DEFAULT_API_URL = 'https://love-alarm-server.onrender.com';
```

3. Toss/App build 환경에 `VITE_API_URL`을 넣을 수 있으면 같은 값으로 설정합니다.

```text
VITE_API_URL=https://love-alarm-server.onrender.com
```

4. 프론트 빌드/배포를 다시 실행합니다.

```bash
npm run build
npm run deploy
```

5. 배포 후 앱에서 `/health`와 로그인 플로우를 확인합니다.

## Rollback

Render 문제가 재발하면 `frontend/src/utils/api.js`의 fallback만 Railway URL로 되돌리고 다시 배포합니다.

```js
const DEFAULT_API_URL = 'https://love-alarm-production.up.railway.app';
```

Railway trial이 이미 끝난 상태라면 rollback은 동작하지 않을 수 있습니다.

## 주의점

- Render 무료 Web Service는 미사용 시 sleep 정책이 있습니다.
- 현재 backend에는 14분 self-ping 방어가 있지만, Render 정책 변경이나 외부 트래픽 상태에 따라 보장되지는 않습니다.
- Render 무료 Postgres는 30일 만료 이슈가 있으므로, DB는 가능하면 기존 외부 Postgres/Supabase 같은 지속 가능한 `DATABASE_URL`을 유지합니다.
