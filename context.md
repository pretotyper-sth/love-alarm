# 좋아하면 울리는 — 컨텍스트 & 다음 작업 정리

## 현재 상태

### 라이브 서비스 (앱인토스 배포 중)
- 위치: `frontend/` (React + Vite + TDS Mobile)
- 주요 기능: 알람 등록/조회, 양방향 매칭 확인, 인앱 결제(알람 슬롯)
- 인증 없음: 인스타그램 ID를 자유 입력 방식으로 받고 있음 (미검증)
- 저장소: LocalStorage 기반 (서버 없음)

### 목업 파일 (구조 개선용 레퍼런스)
- 위치: `reference/demo-snapshot.html`
- 단일 HTML 파일 (CSS/JS 포함), 서버 없이 브라우저에서 바로 열람 가능
- 이 목업을 기반으로 실제 서비스를 순차적으로 개선할 예정
- 로컬 서버: `reference/` 디렉토리에서 `python3 -m http.server 8080` 실행

---

## 목업에서 설계 / 확정된 UX

### 1. 인스타그램 인증 플로우 (단일 바텀시트)

**인증이 필요한 진입점 (확정)**
- **랭킹 노출 동의**: 토글 ON 시도 시 → 인증 바텀시트 (랭킹 시스템 노출할 때 함께 도입)
- **받은 메세지 탭**: 접근 시 → 인증 바텀시트 (메세지 기능 도입할 때 함께 도입)
- **더보기 탭 상단**: 메세지 기능 도입 시점부터 "인스타그램 연동" 항목 상단 노출 — 미리 인증해두려는 유저 자발적 진입 가능

> ⚠️ 알람 추가 페이지는 인증 불필요. 단, 한 번이라도 인증한 유저는 본인 ID 필드가 인증된 ID로 자동 채워지고 **수정 불가** (읽기 전용으로 고정).

동일한 단일 바텀시트가 모든 진입점에서 열린다.

**바텀시트 구조 (한 화면, 화면 전환 없음)**
```
[제목] 인스타그램 인증
[설명] 해당 기능을 사용하려면 최초 인증이 필요해요.
       한 번만 인증하면 모든 기능을 이용할 수 있어요.

1. 인스타그램 아이디 입력  [코드 요청하기 버튼]
   → 버튼 클릭 후 '코드 대기 중 (MM:SS)' 10분 카운트다운 표시

2. @lovealarm.kr 을 팔로우해요  [복사 버튼]

3. DM으로 '인증' 이라고 보내요

4. 받은 6자리 코드를 입력해요  [OTP 6박스 입력]

※ 다음의 경우 코드가 오지 않아요.
 - 팔로우를 하지 않은 경우
 - '인증'이 아닌 다른 메시지를 보낸 경우

[취소]  [확인]  (1 row 좌우 버튼)
```

**에러 메시지**: "코드가 일치하지 않거나 만료되었습니다."
**인증 성공**: 시트 닫힘 + "인증을 완료했어요" 토스트

### 2. 나를 좋아하는 사람 확인 (하단 고정 바)

**하단 고정 바 텍스트**: "나를 좋아하는 사람 **?** 명" (? 또는 숫자: bold + 파란색 `#3d85f5`)
**우측**: "알아보기 →" (알아보기 텍스트 + 화살표)

**진입 플로우**
- 미인증: 바 클릭 → ID 입력창(empty) + "광고 보고 확인하기" 버튼
- 인증 후: ID 입력창 보이되, 연동 계정 ID 자동 채워짐 + 수정 가능 (다른 사람 확인도 허용)
  - 힌트: "인증된 계정이에요. 다른 ID로 바꿔서 확인할 수도 있어요."
- 광고 시청 완료 → 모달 닫힘 + 토스트: **"지금 이 순간 N명이 나를 좋아하고 있어요"**
- 12시간 타이머 시작

**카운트 갱신 전략 (확정)**
- WebSocket 불필요. 사용자 액션 기반 조용한 재조회.
- **트리거 1**: 앱 포그라운드 복귀 시 (`visibilitychange`)
- **트리거 2**: 알람 목록 화면에서 당겨서 새로고침
- **조건**: 광고 시청 후 12시간 이내에만 광고 없이 자동 재조회
- **12시간 초과**: "?" 로 자동 리셋 → 다시 광고 봐야 확인 가능

### 3. 인기 랭킹 페이지
- **현재 하단 탭에서 숨김 처리** (유저 수 적어 역효과 우려, 노출 시점 미정)
- 무한 스크롤 (10명씩), 최대 100명
- 마지막 항목이 바텀 메뉴 바로 위에 딱 붙도록 동적 높이 계산
- 스크롤 바닥 도달 시 "더 이상 표시할 항목이 없습니다" 토스트 — 탭/필터 변경 전까지 1회만
- 필터: 기간(일간/주간/월간/누적) × 성별(전체/남/여)

**랭킹 노출 시점 기준 (미정)**
- 충분한 유저 수 확보 후 노출 여부 결정
- 초기 노출은 top N명으로 제한 권장

### 4. 하단 내비게이션 (현재 3탭 구조)
```
알람 목록  |  보상  |  더보기
```
(랭킹 탭 숨김 — 기획 결정 시 4탭으로 복원)

### 5. 더보기 — 알림 설정 & 인스타그램 연동
```
[메세지 기능 도입 이후 상단 추가]
인스타그램 연동   [연동 전: "연동하기" CTA / 연동 후: "@username 연동됨" 표시]
─── (구분선) ───

연결 시 푸시 알림   [토글 기본 ON]
연결 시 토스 앱 알림 [토글 기본 OFF]
─── (구분선) ───
인기 랭킹 노출 동의  [토글 기본 OFF, 현재 숨김]
  → ON 시도 시 인증 바텀시트 → 인증 후 랭킹 동의 모달
```

### 6. 보상 (체크인)
- **10일 체크인**: 알람 슬롯 1개 무료 추가 (반복 가능)
  - "받기" 버튼 항상 노출, 조건 미충족/수령 후 `disabled`
  - 조건 충족 시 `enabled`
- **60일 체크인**: 광고 영구 제거

### 7. 알람 추가/목록
- 하루 추가 제한: `총 슬롯 수 × 2` 번 (슬롯 2개 → 하루 4번)
- 초과 시 토스트: "하루 최대 N번까지 추가할 수 있어요."
- 목록은 동적 렌더링 (`alarms` 배열 기반)
- **본인 ID 필드 동작**:
  - 미인증: 자유 입력 (현재 상태 유지)
  - 인증 완료 후: 인증된 ID 자동 채워짐 + 수정 불가 (읽기 전용)

### 8. 메세지 확인 페이지
- "내가 보낸 메세지" 탭: 미인증에서도 접근 가능
- "받은 메세지" 탭: 인증 필요 → 미인증 시 인증 CTA 노출
- 탭 전환 시 인증 CTA가 올바르게 표시/숨김 처리됨
- **메세지 상세 바텀시트**: 받은 메세지 행 탭 시 전체 내용 + 반응 선택 한 화면에서 처리
  - 리스트에서는 줄 생략(preview), 탭하면 시트에서 전체 내용 표시
  - 시트 하단 반응 이모지: ❤️ 😊 🤔 😳 🥹
  - 이미 반응한 이모지 하이라이트 표시
  - 시트 닫힐 때 자동 unread 처리
- 발신자 표기: "알 수 없는 누군가로부터" (회색, 12px)
- 배지 카운트: 메세지 페이지 최초 진입 시 모두 cleared

---

## 인스타그램 DM 인증 구현 현황

### 채택된 방식 (백엔드 구현 완료)
```
1. 앱에서 인스타그램 사용자명 입력
2. 유저가 인스타 앱에서 @lovealarm.kr 팔로우 후 DM '인증' 발송
3. 서버 webhook 수신 → username 조회 → 세션 매칭
   → 6자리 코드 생성 → DM 자동 응답
4. 유저가 앱에서 코드 입력 → 인증 완료
```

### Meta Developer 앱 설정
- **앱 ID**: `1585568342670704`
- **Instagram 비즈니스 계정**: `lovealarm.kr` (ID: `17841439221705541`, 신플랫폼 ID: `34741075112172525`)
- **권한**: `instagram_business_basic`, `instagram_business_manage_messages`
- **Webhook**: `messages` 필드 구독 완료
- **계정 레벨 구독**: `POST https://graph.instagram.com/v22.0/me/subscribed_apps?subscribed_fields=messages` 완료
- **코드 만료 시간**: 10분

### 백엔드 (`backend/`)
- `prisma/schema.prisma`: `VerificationSession` 모델 (userId, instagramUsername, igUserId, code, status, expiresAt)
- `src/services/instagramMessaging.js`: username 조회 + DM 발송
- `src/services/instagramWebhookHandler.js`: webhook → 세션 매칭 → DM 응답
- `src/routes/verifyInstagram.js`: `POST /api/verify/instagram/start`, `POST /api/verify/instagram/confirm`
- `src/routes/webhooksInstagram.js`: `GET/POST /webhook/instagram`

### 환경 변수
```
META_VERIFY_TOKEN="a00d330a3b75e6c47d4e9329da6fc0023bfdb4ee101d5c78"
INSTAGRAM_ACCESS_TOKEN="IGAARkAchKx0ZABZAFpfVXp..."  # 60일마다 재발급 필요
INSTAGRAM_BUSINESS_ACCOUNT_ID="17841439221705541"
```

### ⚠️ 핵심 발견 사항
- 신 Instagram Platform은 `graph.facebook.com` 대신 **`graph.instagram.com`** 사용
- Webhook은 **Live 모드에서만** 실제 DM 트리거 (Development 모드 불가)
- App Review 불필요: `lovealarm.kr` 직접 운영 계정, Standard Access로 충분

---

## 배포 & 검수 계획

### 검수 1 — 앱 전반 UI/UX 개선 (백엔드 없음)
> Unit 1 + 2 + 3 + 4 + 5 묶음. "기존 기능 개선" 으로 리뷰어에게 설명 가능.

- [ ] **Unit 1**: 하단 네비게이션 3탭 (랭킹 탭 숨김)
- [ ] **Unit 2**: 더보기 알림 설정 텍스트 수정 + 개발자 bypass 버튼 (live 숨김)
- [ ] **Unit 3**: 매칭 확인 페이지 — 바텀시트 → 전체 페이지 전환, "나" → "본인"
- [ ] **Unit 4**: 보상 체크인 — "15일" → "10일", "영구 누적" 제거, "받기" 버튼 항상 노출 (disabled 기본)
- [ ] **Unit 5**: 알람 추가 — 하루 추가 제한 (`총 슬롯 × 2`) + 메세지(선택) 필드 + copy 수정

### 검수 2 — 인스타그램 인증 도입 ✅ 승인 완료 (2026-04-08)
> Unit 6 단독. Meta 앱 Live 전환 + Railway webhook URL 교체 완료.
> 메세지 기능(검수 4)과 함께 들어가므로, 검수 2는 인증 인프라 + 더보기 연동 항목이 핵심.

- [ ] **Unit 6**: 인증 바텀시트 전체 구현
  - 아이디 입력 + 코드 요청 버튼 (1행)
  - @lovealarm.kr 팔로우 안내 + 복사 버튼
  - DM '인증' 발송 안내
  - OTP 6박스 + 10분 카운트다운
  - 에러: "코드가 일치하지 않거나 만료되었습니다."
  - 성공: "인증을 완료했어요" 토스트
  - **진입점**: 더보기 탭 상단 "인스타그램 연동" 항목 (자발적), 받은 메세지 탭 접근 시, 랭킹 노출 동의 토글 ON 시
  - **더보기 탭**: 인스타그램 연동 항목 상단 추가 (연동 전 CTA / 연동 후 "@username 연동됨")
  - **알람 추가 페이지**: 인증 완료 후 본인 ID 읽기 전용으로 자동 채워짐

### 검수 3 — 나를 좋아하는 사람 수 확인
> Unit 7 단독. 서버 집계 API + AdMob 광고 연동.

- [ ] **Unit 7**: 나를 좋아하는 사람 수 확인 기능
  - 하단 고정 바 UI
  - ID 입력창 (인증 여부 무관 항상 표시, 인증 시 연동 계정 pre-fill + 수정 가능)
  - 서버 API: 입력 ID 기준 알람 등록자 수 집계
  - 결과 토스트: "지금 이 순간 N명이 나를 좋아하고 있어요"
  - 12h 캐시 + 조용한 재조회 (앱 포그라운드 복귀, 당겨서 새로고침)

### 검수 4 — 메세지 페이지
> Unit 8 단독. 서버 메세지 API + 인증 시스템 의존. 백엔드 준비 완료 후 진행.

- [ ] **Unit 8**: 메세지 페이지
  - 탭 구조 (내가 보낸 메세지 / 받은 메세지)
  - 받은 메세지 탭: 미인증 시 인증 CTA
  - 메세지 상세 바텀시트 (전체 내용 + 이모지 반응: ❤️ 😊 🤔 😳 🥹)
  - 배지 카운트: 메세지 페이지 최초 진입 시 cleared

### 브랜치 운영 원칙

- `main`은 항상 **현재 라이브 기준**으로 유지한다.
- `review/x` 브랜치는 **검수 제출용 임시 브랜치**로만 사용한다.
- 검수 요청은 `main`에서 분기한 `review/x`에서 진행하고, 통과 전 수정도 해당 브랜치에서만 반영한다.
- 검수 통과 후에는 해당 브랜치의 승인 기준 커밋을 `main`에 반영한다.
- 반영 직후 새 작업 기준은 다시 `main`으로 되돌린다.
- 기존 `review/x` 브랜치는 즉시 삭제하지 않고, 단기 롤백/비교용으로 잠시 유지한 뒤 정리한다.

### 현재 운영 메모

- `review/2+` 빌드 `019d7026-fc2b-78e2-9151-5f226b1e28d1` 는 검수 통과 완료.
- 승인 기준 커밋은 `main`에 통합 완료 (`8e78f84`).
- 통합 후에도 `review/2` 브랜치는 당분간 유지하고, 다음 검수 작업의 출발점은 `main`으로 전환한다.

---

## 남은 작업

### Phase 1 — 인증 시스템 라이브 연결 (최우선)

- [ ] **Meta 앱 Live 전환**
  - Meta 대시보드 → "게시" → 개인정보처리방침 URL 입력 후 게시
  - 개인정보처리방침: `https://love-alarm.vercel.app/privacy.html`
  - 이용약관: `https://love-alarm.vercel.app/terms.html`

- [x] **webhook URL 교체** ✅ (2026-04-08 완료)
  - Meta 대시보드 콜백 URL → `https://love-alarm-production.up.railway.app/webhook/instagram` 으로 변경 완료

- [ ] **INSTAGRAM_ACCESS_TOKEN 갱신 자동화**
  - IGAA 토큰 60일 만료 → Railway cron job 또는 수동 갱신
  - 갱신 endpoint: `GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token={token}`

### Phase 2 — 목업 → 프론트엔드 반영

위 검수 1~4 계획 참고. 목업(`reference/demo-snapshot.html`)에서 확정된 UX를 `frontend/`에 순서대로 구현.

### Phase 3 — 인프라 & 그로스

- [ ] LocalStorage → 서버 DB 마이그레이션
- [ ] 익명 메시지 기능 (전송, 수신, 이모지 반응)
- [ ] 푸시 알림 (매칭 성공, 새 메시지 수신)
- [ ] 랭킹 데이터 파이프라인 (집계 주기, 캐시 전략)
- [ ] 인기 랭킹 노출 시점 결정 및 탭 복원

---

## 참고

- 앱인토스 정책: 백엔드에서 외부 API 직접 호출 ✅ / 앱 내 외부 redirect ❌
- 프로덕션 서버: `https://love-alarm-production.up.railway.app` (Railway — 2026-04-08 Render에서 이전)
- 개인정보처리방침: `https://love-alarm.vercel.app/privacy.html`
- 이용약관: `https://love-alarm.vercel.app/terms.html`

---

## 서버 인프라 변경 이력

### 2026-04-08 — Render → Railway 이전

**원인**: Render 프리 티어 인프라 불안정 (CloudFlare 521 반복, 컨테이너 라우팅 단절)

**변경 내용**:
- 백엔드 서버: `https://love-alarm-server.onrender.com` → `https://love-alarm-production.up.railway.app`
- Vercel `VITE_API_URL` 환경변수 업데이트 완료
- Meta Instagram 웹훅 콜백 URL 업데이트 완료
- `backend/railway.json`, `backend/Procfile` 추가
- `backend/src/index.js`: `uncaughtException` / `unhandledRejection` 핸들러 추가 (서버 크래시 방지)

**Railway 환경변수**: Render에서 사용하던 동일 값 그대로 복사 (`RENDER_EXTERNAL_URL` 제외)
