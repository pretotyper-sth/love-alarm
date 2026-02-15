# 다른 기기에서 이어서 작업하기

## 1. 저장소 클론

```bash
git clone https://github.com/pretotyper-sth/love-alarm.git
cd love-alarm
```

## 2. 의존성 설치

```bash
npm install
```

## 3. 맥락 파악용 문서 (우선 읽을 것)

| 파일 | 용도 |
|------|------|
| **CURRENT_STATUS.md** | 검수 반려 후 수정 항목, 주요 파일, 라우팅, 빌드/배포, 알려진 이슈 |
| README.md | 서비스 소개, 기술 스택, 실행 방법 |
| SETUP.md | 아이콘·결제 설정 |
| DEPLOY_GUIDE.md | Supabase / Render / Vercel 배포 절차 |

## 4. 로컬 실행

```bash
npm run dev
```

프론트만: `cd frontend && npm run frontend:dev`

---

**최종 코드는 GitHub `main`과 동기화되어 있습니다.** (커밋: OG 이미지 교체)
