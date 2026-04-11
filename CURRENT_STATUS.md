# 좋아하면 울리는 - 현재 상태 (2026-04-11)

## 📍 현재 위치

- **라이브 버전**: 검수 2 (EXP-005, `review/2` → `main`)
- **검수 중**: 검수 3 (`review/3`, EXP-006 좋아하는 사람 수 확인)
- **검수 중**: 검수 4 (`review/4`, EXP-007 메시지 + EXP-008 메시지 수신 알림)
- **현재 브랜치**: `review/4`
- **서버**: Railway (`love-alarm-production.up.railway.app`)

## 🏁 마일스톤

> **review/4까지 = 기본 기능 구축 완료**
> **review/5부터 = 그로스 실험 (A/B 테스트, 퍼널 최적화, 리텐션 실험)**

| 검수 | 브랜치 | 핵심 | 상태 |
|------|--------|------|------|
| 검수 1 | review/1 | 탭바, 체크인, 광고 CTA, 연결 화면 | 🟡 검수 중 |
| 검수 2 | review/2 | 인스타그램 인증 + 초기 진입 | ✅ 라이브 |
| 검수 3 | review/3 | 좋아하는 사람 수 확인 + 로딩 UX | 🟡 검수 중 |
| 검수 4 | review/4 | 메시지 페이지 + 수신 알림 | 🟡 검수 중 |

## ⏳ 대기 중인 작업

### 메시지 수신 알림 (EXP-008)
- **토스 콘솔 검토 요청**: 2026-04-11 제출
- **예상 승인**: 영업일 2~3일
- **코드**: 전부 완료 (Prisma, API, UI, 발송 함수, 트리거)
- **승인 후 할 일**: Railway 배포 (`npx prisma migrate deploy`) + 템플릿 코드 확인

### A/B 테스트 소재
| | 제목 | 본문 |
|---|---|---|
| A안 | 메시지 도착 | 누군가 메시지를 남겼어요. |
| B안 | 새 메시지 | 누군가 마음을 전했어요. |

## 📁 주요 파일

### Frontend
- `frontend/src/App.jsx` — 라우팅 + 스켈레톤 로딩
- `frontend/src/pages/AlarmListPage.jsx` — 알람 목록 + 좋아하는 사람 수 바 + 메시지 배지
- `frontend/src/pages/AddAlarmPage.jsx` — 알람 추가 (광고 + 메시지 입력)
- `frontend/src/pages/MessagesPage.jsx` — 보낸/받은 메시지 + 반응/신고
- `frontend/src/pages/SettingsPage.jsx` — 알림 설정 (연결/메시지 푸시·토스 앱, 배지)
- `frontend/src/pages/RewardsPage.jsx` — 체크인 보상
- `frontend/src/pages/FeedbackPage.jsx` — 피드백/건의
- `frontend/src/components/LikeCountSheet.jsx` — 좋아하는 사람 수 조회 시트

### Backend
- `backend/src/routes/alarms.js` — 알람 CRUD + 메시지 수신 알림 트리거
- `backend/src/routes/messages.js` — 메시지 조회/반응/신고
- `backend/src/routes/users.js` — 사용자 설정 (알림 포함)
- `backend/src/routes/auth.js` — 토스 로그인
- `backend/src/services/pushNotification.js` — 푸시 알림 (mTLS, 연결+메시지)
- `backend/src/services/matching.js` — 매칭 로직
- `backend/prisma/schema.prisma` — DB 스키마

### Config
- `granite.config.ts` — 앱인토스 빌드 설정
- `frontend/vite.config.js` — Vite 빌드 설정

## 🚀 빌드 & 배포

```bash
# Frontend 빌드
cd frontend && npm run build

# 번들 빌드 (.ait 파일 생성)
cd .. && npx granite build

# 배포
# - Backend: Railway (main push 시 자동 배포)
# - 번들: 토스 콘솔에 .ait 업로드
```

## 📚 참고 문서

- [실험 로그](experiments.md) — 전체 실험 기록 및 측정 계획
- [배포 가이드](DEPLOY_GUIDE.md) — Railway 배포 절차
- [앱 테스트 가이드](APP_TEST_GUIDE.md) — 개발 서버 연결 방법
