# 좋아하면 울리는 - Backend

## 기술 스택

- **Server**: Node.js + Express
- **Database**: SQLite (개발) → PostgreSQL (프로덕션)
- **ORM**: Prisma

## 설치 및 실행

### 1. 의존성 설치

```bash
cd backend
npm install
```

### 2. 환경 변수 설정

```bash
# .env 파일 생성
cp .env.example .env
```

또는 직접 `.env` 파일 생성:

```env
DATABASE_URL="file:./dev.db"
PORT=8080
JWT_SECRET="love-alarm-secret-key-change-in-production"
```

### 3. 데이터베이스 초기화

```bash
npm run db:push
```

### 4. 서버 실행

```bash
# 개발 모드 (자동 재시작)
npm run dev

# 프로덕션 모드
npm start
```

서버가 `http://localhost:8080` 에서 실행됩니다.

## API 엔드포인트

### 인증

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/auth/login` | 토스 계정 로그인/회원가입 |

### 사용자

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/users/:id` | 사용자 정보 조회 |
| PUT | `/api/users/:id/instagram` | 인스타그램 ID 등록/수정 |

### 알람

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/alarms?userId=xxx` | 알람 목록 조회 |
| POST | `/api/alarms` | 새 알람 생성 |
| DELETE | `/api/alarms/:id` | 알람 삭제 |

### 헬스체크

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/health` | 서버 상태 확인 |

## 데이터베이스 스키마

```
User
├── id (UUID)
├── tossUserId (토스 계정 ID)
├── instagramId (인스타그램 ID)
└── createdAt, updatedAt

Alarm
├── id (UUID)
├── userId (등록한 사용자)
├── targetInstagramId (대상 인스타 ID)
├── status (waiting | matched)
└── createdAt, updatedAt

Match
├── id (UUID)
├── user1Id, user2Id
└── matchedAt
```

## DB 관리 명령어

```bash
# Prisma Studio (DB GUI)
npm run db:studio

# 스키마 변경 후 DB 반영
npm run db:push

# Prisma Client 재생성
npm run db:generate
```
