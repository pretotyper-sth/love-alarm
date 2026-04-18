# 🚀 좋아하면 울리는 - 배포 가이드 (비개발자용)

이 문서는 개발 지식이 없는 분들도 따라 할 수 있도록 작성된 배포 가이드입니다.
현재는 **Supabase(데이터베이스)**와 **Railway(서버)**를 기준으로 운영합니다.

---

## 📋 준비물 체크

- [x] **Supabase 계정**: 데이터 저장소 (완료)
- [x] **Railway 계정**: 서버 호스팅 (완료)
- [x] **GitHub 계정**: 코드 저장소 (완료)

---

## 🎯 현재 배포 상태

| 항목 | 상태 | 주소 |
|------|------|------|
| 백엔드 서버 | ✅ Live | https://love-alarm-production.up.railway.app |
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

## 3단계: Railway에 백엔드 서버 만들기 ✅ 완료

### 3-1. Web Service 생성

1. [Railway Dashboard](https://railway.app/dashboard)에 접속합니다.
2. **New Project** → GitHub 저장소 연결을 선택합니다.
3. GitHub 저장소 **`love-alarm`** 연결

### 3-2. 설정값 입력 (정확히 따라하세요!)

| 항목 | 값 |
|------|-----|
| **Name** | `love-alarm-production` |
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
VITE_API_URL=https://love-alarm-production.up.railway.app
```

## 5단계: 앱인토스 배포

### 5-1. API 토큰 등록 (최초 1회만)

앱인토스 콘솔에서 API 키를 발급한 후 등록합니다.

> 접속 경로: 앱인토스 콘솔 → 워크스페이스 선택 → 좌측 메뉴 **"키"** → API 키 발급

```bash
npx ait token add --api-key {발급받은_API_키}
```

등록 후에는 API 키를 매번 입력하지 않아도 됩니다.

### 5-2. 빌드 + 업로드 (이후 배포는 이것만)

**프로덕션 빌드 (검수 제출 / 라이브):**
```bash
npm run build && npx ait deploy -m "[검수] 내용"
```

**스테이징 빌드 (테스트용 — 라이브 DB에 영향 없음):**
```bash
npm run build:staging && npx ait deploy -m "[테스트] 내용"
```

| 구분 | 빌드 명령어 | 연결 서버 | 용도 |
|------|------------|-----------|------|
| 프로덕션 | `npm run build` | love-alarm-production.up.railway.app | 검수 제출, 라이브 출시 |
| 스테이징 | `npm run build:staging` | love-alarm-staging-production.up.railway.app | 기능 테스트, bypass 확인 |

`-m` 옵션으로 출시 메모를 반드시 포함해서 업로드하세요 (최대 1000자).  
메모는 콘솔 **앱 출시** 목록에서 어떤 버전인지 구분하는 데 쓰입니다.

**메모 작성 가이드:**

| 상황 | 예시 메모 |
|------|-----------|
| 버그 수정 | `[수정] 보상 토스트 누락, 슬롯 반영 지연, 더보기 간격 통일` |
| 기능 추가 | `[기능] 메시지 알림 추가, 알림 설정 페이지 신설` |
| 스테이징 테스트 | `[테스트] 보상 페이지 bypass 포함 — 스테이징 서버` |
| 최종 검수 제출 | `[검수] 검수 6 최종 제출 — bypass 제거 완료` |

### 5-2-1. 검수 전 표준 테스트 절차

새 기능 개발 후 검수 요청 전에 아래 순서를 따릅니다.

**① 스테이징 테스트 빌드 (bypass 포함)**

```bash
# RewardsPage.jsx에서 IS_DEV = true 로 임시 변경 후
npm run build:staging && npx ait deploy -m "[테스트] {기능명} — bypass 포함, 스테이징 서버"
```

**② 앱에서 기능 확인**
- 스테이징 빌드로 테스트 (라이브 DB에 영향 없음)
- bypass가 필요한 기능(보상 등)은 DEV bypass 박스로 확인

**③ 라이브 빌드 교차 확인**
- `intoss://love-alarm` 라이브 빌드로 전환
- 스테이징에서 한 행동이 라이브에 반영 안 됐는지 확인

**④ 이상 없으면 프로덕션 검수 빌드**

```bash
# IS_DEV = import.meta.env.DEV 로 되돌린 후
npm run build && npx ait deploy -m "[검수] {검수번호} — {변경 내용 요약}"
```

**⑤ 콘솔에서 검수 요청**
- 앱인토스 콘솔 → 앱 출시 → 검토 요청

---

### ⚠️ DEV bypass 주의사항

테스트 편의를 위해 특정 기능(보상 페이지 bypass 등)을 빌드에서도 노출할 경우:

1. `frontend/src/pages/RewardsPage.jsx` 에서 `const IS_DEV = true;` 로 임시 변경
2. **스테이징** 빌드로만 업로드 (`npm run build:staging`)
3. 테스트 완료 후 반드시 `const IS_DEV = import.meta.env.DEV;` 로 되돌리기
4. 프로덕션 빌드 재업로드 (`npm run build`)

> ⚠️ 검수 제출용 최종 빌드에는 bypass가 포함되지 않아야 합니다.

1. 콘솔 **앱 출시** 메뉴에서 업로드된 번들 확인
2. **"테스트하기"** 버튼 클릭 → QR 코드 스캔 또는 위 스킴으로 실행
3. 테스트를 최소 1회 완료해야 검수 요청 가능

### 5-4. 검수 요청

앱인토스 콘솔 → 앱 선택 → **앱 출시** → **검토 요청**

---

### ⚠️ DEV bypass 주의사항

테스트 편의를 위해 특정 기능(보상 페이지 bypass 등)을 앱 빌드에서도 노출할 경우:

1. 해당 파일에서 `const IS_DEV = true;` 로 임시 변경
2. 빌드 + 업로드 (`npm run build && npx ait deploy`)
3. 앱에서 테스트 확인 후
4. 반드시 `const IS_DEV = import.meta.env.DEV;` 로 되돌리고 최종 빌드 재업로드

검수 제출용 최종 빌드에는 bypass가 포함되지 않아야 합니다.

---

## 🆘 트러블슈팅

### "Can't reach database server" 에러

**원인**: Supabase의 Direct Connection은 IPv6만 지원하는데, Railway 환경에서는 Session Pooler 구성이 더 안정적입니다.

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
| 백엔드 서버 | https://love-alarm-production.up.railway.app |
| 백엔드 헬스체크 | https://love-alarm-production.up.railway.app/health |
| GitHub 저장소 | https://github.com/pretotyper-sth/love-alarm |
| Supabase 대시보드 | https://supabase.com/dashboard |
| Railway 대시보드 | https://railway.app/dashboard |

---

## ⚠️ 무료 서버 주의사항

무료 서버/슬립 정책은 배포 플랜에 따라 달라질 수 있습니다.
- 첫 접속 시 30~50초 정도 깨어나는 시간이 필요합니다.
- 유저가 많아지면 유료 플랜($7/월)으로 업그레이드하면 해결됩니다.
