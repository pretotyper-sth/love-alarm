# 프로젝트 구조

프로젝트는 프론트엔드(FE)와 백엔드(BE)로 구분되어 있습니다.

## 📂 폴더 구조

```
love-alarm/
├── frontend/              # 프론트엔드 애플리케이션
│   ├── src/               # 소스 코드
│   │   ├── pages/         # 페이지 컴포넌트
│   │   ├── components/    # 재사용 가능한 컴포넌트
│   │   ├── utils/         # 유틸리티 함수
│   │   ├── App.jsx        # 라우팅 설정
│   │   └── main.jsx       # 앱 진입점
│   ├── public/            # 정적 파일
│   ├── index.html         # HTML 진입점
│   ├── vite.config.js     # Vite 설정
│   └── eslint.config.js   # ESLint 설정
│
├── backend/               # 백엔드 서버 (향후 구현 예정)
│   └── README.md          # 백엔드 설명
│
├── granite.config.ts      # Granite 설정 (토스 앱인토스)
├── package.json           # 프로젝트 의존성
├── README.md              # 프로젝트 메인 문서
└── SETUP.md               # 설정 가이드
```

## 🎯 Frontend (frontend/)

프론트엔드 관련 모든 파일이 위치합니다.

### 주요 파일
- `src/`: React 애플리케이션 소스 코드
- `public/`: 정적 파일 (이미지, 아이콘 등)
- `index.html`: HTML 진입점
- `vite.config.js`: Vite 빌드 도구 설정
- `eslint.config.js`: 코드 린팅 설정

### 실행 방법
프로젝트 루트에서 실행:
```bash
npm run dev      # 개발 서버 실행 (granite dev)
npm run build    # 프로덕션 빌드 (granite build)
```

또는 frontend 폴더에서 직접 실행:
```bash
cd frontend
npm run frontend:dev    # 개발 서버 실행
npm run frontend:build  # 프로덕션 빌드
```

## 🔧 Backend (backend/)

백엔드 서버 코드가 위치할 폴더입니다.

### 현재 상태
현재는 백엔드 서버가 없으며, 모든 데이터는 프론트엔드의 로컬 스토리지에 저장됩니다.

### 향후 계획
서버 연동이 필요한 경우 다음 기능들을 구현할 수 있습니다:
- 사용자 인증 및 인가
- 알람 데이터 서버 저장
- 실시간 매칭 확인
- 푸시 알림 서비스
- 결제 검증 및 처리
- 통계 및 분석

## ⚙️ 설정 파일

### 루트 레벨 설정 파일
- `granite.config.ts`: 토스 앱인토스 설정 (앱 이름, 아이콘, 색상 등)
- `package.json`: 프로젝트 의존성 및 스크립트

### Frontend 설정 파일
- `frontend/vite.config.js`: Vite 빌드 설정
- `frontend/eslint.config.js`: ESLint 린팅 규칙

## 📝 파일 이동 이력

프로젝트 구조를 FE/BE로 구분하기 위해 다음 파일들이 이동되었습니다:

**Frontend로 이동:**
- `src/` → `frontend/src/`
- `public/` → `frontend/public/`
- `index.html` → `frontend/index.html`
- `vite.config.js` → `frontend/vite.config.js`
- `eslint.config.js` → `frontend/eslint.config.js`

**Backend 생성:**
- `backend/` 폴더 생성 (향후 백엔드 코드용)

**루트에 유지:**
- `granite.config.ts` (토스 앱인토스 설정)
- `package.json` (프로젝트 의존성)
- `README.md` (프로젝트 문서)
- `SETUP.md` (설정 가이드)

## 🔄 개발 워크플로우

1. **프론트엔드 개발**
   - `frontend/src/`에서 React 컴포넌트 작성
   - `npm run dev`로 개발 서버 실행
   - 변경사항은 Hot Module Replacement로 자동 반영

2. **백엔드 개발 (향후)**
   - `backend/` 폴더에 서버 코드 작성
   - 별도의 서버 실행 스크립트 필요

3. **빌드 및 배포**
   - `npm run build`로 프론트엔드 빌드
   - `npm run deploy`로 토스 앱인토스에 배포




