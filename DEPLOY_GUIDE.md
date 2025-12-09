# 🚀 좋아하면 울리는 - 배포 가이드 (비개발자용)

이 문서는 개발 지식이 없는 분들도 따라 할 수 있도록 작성된 배포 가이드입니다.
비용이 전혀 들지 않는 **Supabase(데이터베이스)**와 **Render(서버)**를 사용하여 배포합니다.

---

## 📋 준비물 체크

- [ ] **Supabase 계정**: 데이터 저장소 (회원가입 완료)
- [ ] **Render 계정**: 서버 호스팅 (회원가입 필요: [https://render.com](https://render.com))
- [ ] **GitHub 계정**: 코드 저장소 (코드를 Render로 보내기 위해 필요)

---

## 1단계: 코드를 GitHub에 올리기

Render는 GitHub에 있는 코드를 가져와서 서버를 실행합니다.

1. GitHub에 로그인하고 **New Repository**를 만듭니다. (예: `love-alarm-backend`)
2. 이 프로젝트 폴더를 GitHub에 업로드합니다.
   (VS Code나 Cursor의 Source Control 탭을 이용하거나 터미널 명령어를 사용합니다)

## 2단계: Render에 백엔드 서버 만들기

1. [Render Dashboard](https://dashboard.render.com/)에 접속합니다.
2. **New +** 버튼을 누르고 **Web Service**를 선택합니다.
3. **Build and deploy from a Git repository**를 선택하고 **Next**를 누릅니다.
4. 방금 만든 GitHub 저장소(`love-alarm-backend`)를 연결합니다.
5. 설정 화면에서 다음 내용을 입력합니다:
   - **Name**: `love-alarm-server` (원하는 이름)
   - **Region**: `Singapore` (한국과 가까워서 빠름) 또는 `Oregon`
   - **Branch**: `main`
   - **Root Directory**: `backend` (중요! 우리는 백엔드 폴더가 따로 있으므로 꼭 입력해야 합니다)
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run db:generate`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free` (무료)

6. **Environment Variables (환경 변수)** 섹션으로 내려가서 **Add Environment Variable**을 누르고 다음 값들을 추가합니다:

   | Key | Value | 설명 |
   |-----|-------|------|
   | `DATABASE_URL` | `postgresql://...` | 아까 메모장에 적어둔 **Supabase 주소** 전체 |
   | `JWT_SECRET` | `lovealarm1234!@#` | 보안 키 (예: `lovealarm1234!@#`) |
   | `NODE_ENV` | `production` | 프로덕션 모드 설정 |
   | `CORS_ORIGIN` | `*` | 임시로 모든 접속 허용 (나중에 프론트엔드 주소 나오면 변경) |

7. **Create Web Service** 버튼을 클릭합니다.
8. 서버가 생성되는 동안 기다립니다. (약 3~5분 소요)
9. 완료되면 상단에 `https://love-alarm-server.onrender.com` 같은 **서버 주소**가 생깁니다. **이 주소를 복사해두세요!**

## 3단계: 데이터베이스 초기화

서버가 처음 실행되면 데이터베이스 구조를 만들어야 합니다.
Render의 **Shell** 탭(터미널처럼 생긴 곳)에 들어가서 다음 명령어를 입력하고 엔터를 칩니다:

```bash
npm run db:push
```

초록색으로 성공 메시지가 뜨면 DB 준비 완료!

## 4단계: 앱(프론트엔드) 설정 변경

이제 내 컴퓨터에 있는 앱 코드가 방금 만든 서버를 바라보도록 설정해야 합니다.

1. 프로젝트 폴더의 `frontend` 폴더 안에 `.env` 파일을 만듭니다. (이미 있다면 수정)
2. 다음 내용을 입력합니다:

```env
VITE_API_URL=https://love-alarm-server.onrender.com
```
(방금 복사한 Render 서버 주소를 넣으세요. 끝에 `/`는 뺍니다)

## 5단계: 앱인토스 배포

이제 모든 준비가 끝났습니다! 토스 서버로 앱을 보냅니다.

1. 터미널을 열고 다음 명령어를 실행합니다:

```bash
npm run deploy
```

2. 로그인이 필요하면 브라우저가 뜨면서 토스 로그인을 요청할 겁니다.
3. 배포가 완료되면 **토스 개발자 센터**에서 새 버전을 확인하고 테스트할 수 있습니다.

---

## 🆘 자주 발생하는 문제

- **서버가 자꾸 꺼져요**: 무료 서버라 15분 동안 사용자가 없으면 잠듭니다. 다시 접속하면 30초 정도 깨어나는 시간이 필요해요.
- **DB 연결 에러**: Supabase 비밀번호에 특수문자가 있으면 URL 인코딩이 필요할 수 있습니다. 비밀번호는 되도록 영문+숫자로만 간단히 설정하세요.


