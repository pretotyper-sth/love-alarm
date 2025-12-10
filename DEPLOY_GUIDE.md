# 🚀 좋아하면 울리는 - 배포 가이드 (비개발자용)

이 문서는 개발 지식이 없는 분들도 따라 할 수 있도록 작성된 배포 가이드입니다.
비용이 전혀 들지 않는 **Supabase(데이터베이스)**와 **Render(서버)**를 사용하여 배포합니다.

---

## 📋 준비물 체크

- [x] **Supabase 계정**: 데이터 저장소 (완료)
- [x] **Render 계정**: 서버 호스팅 (완료)
- [x] **GitHub 계정**: 코드 저장소 (완료)

---

## 🎯 현재 배포 상태

| 항목 | 상태 | 주소 |
|------|------|------|
| 백엔드 서버 | ✅ Live | https://love-alarm-server.onrender.com |
| 데이터베이스 | ✅ 연결됨 | Supabase PostgreSQL (Session Pooler) |
| 프론트엔드 | ⏳ 배포 대기 | 앱인토스 배포 필요 |

---

## 1단계: 코드를 GitHub에 올리기 ✅ 완료

코드는 **`love-alarm`** 저장소에 업로드되어 있습니다.
- 저장소 주소: `https://github.com/pretotyper-sth/love-alarm`

### Git 초기 설정 (처음 한 번만)
```bash
git config --global user.email "your-email@example.com"
git config --global user.name "Your Name"
```

## 2단계: Supabase 데이터베이스 설정 ✅ 완료

### 2-1. Supabase 프로젝트 생성
1. [Supabase](https://supabase.com/)에 가입하고 새 프로젝트를 생성합니다.
2. 비밀번호는 **특수문자 없이 영문+숫자**로만 설정하세요. (URL 인코딩 문제 방지)

### 2-2. Connection String 복사 (⚠️ 중요!)

Supabase는 IPv4/IPv6 호환성 문제가 있어서 **Session Pooler** 모드를 사용해야 합니다.

1. Supabase 대시보드 → **Settings** → **Database**
2. **Connect to your project** 클릭
3. 다음과 같이 설정:
   - **Type**: URI
   - **Source**: Primary Database
   - **Method**: **Session pooler** (⚠️ 반드시 이걸로!)
4. 나오는 URL을 복사합니다. (형식: `postgresql://postgres.프로젝트ID:비밀번호@aws-...-pooler.supabase.com:5432/postgres`)
5. `[YOUR-PASSWORD]` 부분을 실제 비밀번호로 교체합니다.

## 3단계: Render에 백엔드 서버 만들기 ✅ 완료

### 3-1. Web Service 생성

1. [Render Dashboard](https://dashboard.render.com/)에 접속합니다.
2. **New +** → **Web Service** 선택
3. GitHub 저장소 **`love-alarm`** 연결

### 3-2. 설정값 입력 (정확히 따라하세요!)

| 항목 | 값 |
|------|-----|
| **Name** | `love-alarm-server` |
| **Region** | `Singapore` 또는 `Oregon` |
| **Branch** | `main` |
| **Root Directory** | `backend` (⚠️ 필수!) |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npx prisma db push --accept-data-loss && npm start` |
| **Instance Type** | `Free` |

### 3-3. 환경 변수 설정

**Environment** 탭에서 다음 변수들을 추가합니다:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | `postgresql://postgres.프로젝트ID:비밀번호@aws-...-pooler.supabase.com:5432/postgres` |
| `JWT_SECRET` | 아무 문자열 (예: `LoveAlarm2025Secret`) |
| `NODE_ENV` | `production` |
| `CORS_ORIGIN` | `*` |

### 3-4. 배포 확인

**Create Web Service** 클릭 후 로그를 확인합니다.
다음 메시지가 나오면 성공입니다:
```
🚀  Your database is now in sync with your Prisma schema.
🚀 서버가 http://localhost:10000 에서 실행 중입니다.
🔌 WebSocket 활성화됨
==> Your service is live 🎉
```

## 4단계: 프론트엔드 설정 ✅ 완료

`frontend/.env` 파일에 서버 주소가 설정되어 있습니다:
```env
VITE_API_URL=https://love-alarm-server.onrender.com
```

## 5단계: 앱인토스 배포

### 5-1. 배포 명령어 실행

프로젝트 루트 폴더에서 터미널을 열고 실행합니다:
```bash
npm run deploy
```

### 5-2. 토스 개발자 센터에서 테스트

1. 배포가 완료되면 토스 개발자 센터에서 새 버전 확인
2. 개발자 모드에서 테스트 진행
3. 문제없으면 심사 요청

---

## 🆘 트러블슈팅

### "Can't reach database server" 에러

**원인**: Supabase의 Direct Connection은 IPv6만 지원하는데, Render는 IPv4만 지원합니다.

**해결**: Session Pooler 사용
- Supabase에서 **Method: Session pooler** 선택
- URL이 `pooler.supabase.com`을 포함해야 함

### "Tenant or user not found" 에러

**원인**: Pooler 모드에서는 username 형식이 다릅니다.

**해결**: username을 `postgres.프로젝트ID` 형식으로 변경
- ❌ `postgres:비밀번호@...`
- ✅ `postgres.psexdcugzmzbzfuknxoi:비밀번호@...`

### "Schema engine error" 또는 타임아웃

**원인**: Build 단계에서 DB 접속 시 타임아웃 발생

**해결**: DB 초기화를 Start Command로 이동
- Build Command: `npm install`
- Start Command: `npx prisma db push --accept-data-loss && npm start`

### 비밀번호 특수문자 문제

**원인**: URL에서 `%`, `@`, `#` 등 특수문자가 오작동을 일으킵니다.

**해결**: 비밀번호를 영문+숫자로만 재설정

---

## 📌 주요 URL 정리

| 서비스 | URL |
|--------|-----|
| 백엔드 서버 | https://love-alarm-server.onrender.com |
| 백엔드 헬스체크 | https://love-alarm-server.onrender.com/health |
| GitHub 저장소 | https://github.com/pretotyper-sth/love-alarm |
| Supabase 대시보드 | https://supabase.com/dashboard |
| Render 대시보드 | https://dashboard.render.com |

---

## ⚠️ 무료 서버 주의사항

Render 무료 서버는 **15분 동안 접속이 없으면 절전 모드**에 들어갑니다.
- 첫 접속 시 30~50초 정도 깨어나는 시간이 필요합니다.
- 유저가 많아지면 유료 플랜($7/월)으로 업그레이드하면 해결됩니다.
