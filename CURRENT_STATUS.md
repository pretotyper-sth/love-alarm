# 좋아하면 울리는 - 현재 상태 (2026-01-08)

## 🔴 검수 반려 후 수정 중인 항목

### 1. ❓ 다이얼로그 (백버튼 종료 확인)
- **파일**: `frontend/src/App.jsx`
- **상태**: 코드는 수정됨, 웹에서 확인 필요
- **문제**: TDS ConfirmDialog가 제대로 렌더링되지 않음 (흰색 배경 없음, 버튼 둘 다 파란색)
- **앱 빌더 코드** (이대로 해야 함):
```jsx
import { ConfirmDialog } from '@toss/tds-mobile'

<ConfirmDialog
  title="좋아하면 울리는을 종료할까요?"
  cancelButton={
    <ConfirmDialog.CancelButton size="xlarge">취소</ConfirmDialog.CancelButton>
  }
  confirmButton={
    <ConfirmDialog.ConfirmButton size="xlarge">종료하기</ConfirmDialog.ConfirmButton>
  }
/>
```
- **버튼 속성**:
  - left (취소): type="dark", style="weak", size="xlarge"
  - right (종료하기): type="primary", style="fill", size="xlarge"

### 2. ✅ 공유 링크 (intoss:// 딥링크)
- **파일**: `frontend/src/pages/SettingsPage.jsx`
- **상태**: 코드 수정 완료
- **코드**:
```javascript
const OG_IMAGE_URL = 'https://static.toss.im/appsintoss/9737/f6aa6697-d258-40c2-a59f-91f8e8bab8be.png';

const tossLink = await getTossShareLink('intoss://love-alarm', OG_IMAGE_URL);
await share({ message: tossLink });
```
- **참고**: 출력 링크는 `https://toss.im/_m/...` 형태가 정상 (내부에 intoss:// 포함)

### 3. ✅ 광고 사전 고지
- **파일**: `frontend/src/pages/AddAlarmPage.jsx`
- **상태**: 완료
- **변경**: 버튼 텍스트 "추가하기" → "광고 보고 추가하기"

### 4. ✅ 기능 스킴 (콘솔 설정)
- **콘솔에서 설정**: `intoss://love-alarm/alarms`

### 5. ✅ 백버튼 종료 처리
- **파일**: `frontend/src/App.jsx`
- **상태**: 코드 완료 (다이얼로그 렌더링 문제만 해결하면 됨)
- **방식**: History API + popstate 이벤트 + ConfirmDialog

---

## 📁 주요 파일

### Frontend
- `frontend/src/App.jsx` - 라우팅 + 백버튼 종료 다이얼로그
- `frontend/src/pages/IntroPage.jsx` - 온보딩/로그인
- `frontend/src/pages/AlarmListPage.jsx` - 알람 목록
- `frontend/src/pages/AddAlarmPage.jsx` - 알람 추가 (광고)
- `frontend/src/pages/SettingsPage.jsx` - 설정 (공유 기능)
- `frontend/src/components/PaymentModal.jsx` - 인앱 결제

### Backend
- `backend/src/routes/auth.js` - 토스 로그인
- `backend/src/services/tossAuth.js` - 토스 API 통신 (mTLS)
- `backend/src/services/pushNotification.js` - 푸시 알림

### Config
- `granite.config.ts` - 앱인토스 빌드 설정
- `frontend/vite.config.js` - Vite 빌드 설정

---

## 🔧 라우팅 로직

```
/ (루트)
  └── hasVisited = true → /alarms 리다이렉트
  └── hasVisited = false → IntroPage (온보딩)

/alarms
  └── hasVisited = true → AlarmListPage
  └── hasVisited = false → / 리다이렉트 (온보딩 먼저)
```

**첫 방문자가 공유 링크(/alarms)로 접근하면 → / → IntroPage 표시**

---

## 🚀 빌드 & 배포

```bash
# Frontend 빌드
cd frontend && npm run vite:build

# 번들 빌드 (.ait 파일 생성)
cd .. && npx granite build

# 배포
# - Frontend: Vercel
# - Backend: Render
# - 번들: 토스 콘솔에 업로드
```

---

## 📝 콘솔 설정 (검수 요청 시)

- **기능 이름**: 15자 이내로 서비스 가치 전달
  - 예: "좋아하는 사람 등록하기", "마음 전달하기" 등
- **기능 스킴**: `/alarms` (intoss://love-alarm/alarms)
- **딥링크**: `intoss://love-alarm` 스킴 사용

---

## ⚠️ 알려진 이슈

1. **TDS ConfirmDialog 렌더링 문제**
   - 웹에서 제대로 안 보임
   - 앱에서 테스트 필요

2. **OG 이미지 캐싱**
   - 카카오톡 디버거로 캐시 클리어 필요: https://developers.kakao.com/tool/clear/og

---

## 📚 참고 문서

- [TDS ConfirmDialog](https://tossmini-docs.toss.im/tds-mobile/components/Dialog/confirm-dialog/)
- [getTossShareLink](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/공유/getTossShareLink.html)
- [백버튼 처리](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/UI/Config.html)
- [인앱 결제](https://developers-apps-in-toss.toss.im/iap/develop.html)
- [리워드 광고](https://developers-apps-in-toss.toss.im/admob/develop.html)

