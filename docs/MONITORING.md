# 운영 경고와 제한 부하 검증

## 권한과 활성화

- `/internal/monitor`는 별도 `MONITORING_TOKEN`(최소 32자)을 Bearer 헤더로 받아야 합니다. 설정 전 503, 인증 실패 401입니다. 토큰을 URL에 넣지 않습니다.
- 이 토큰은 운영 집계 조회만 허용합니다. 회원·메시지·인스타그램 ID·결제 내역 조회나 수정, 로그인 발급에는 사용할 수 없습니다. 대시보드·로그인 비밀번호를 재사용하지 않습니다.
- 승인 후 Render 환경변수와 GitHub Actions repository secret에 같은 `MONITORING_TOKEN`을 등록합니다. GitHub repository variable `MONITORING_ENABLED=true`로 정기 실행을 활성화합니다. 활성화 전 예약 작업은 건너뜁니다.
- `.github/workflows/service-monitor.yml`은 5분 간격으로 상태를 읽습니다. GitHub 예약 실행은 지연될 수 있어 정확한 5분 SLA는 아닙니다. 서버가 정지해도 외부 실행기는 동작합니다.
- 무료 Render가 15분 유휴 상태로 잠들지 않을 수 있습니다. 월 750시간은 워크스페이스 서비스들이 공유합니다. 공개 저장소 표준 GitHub-hosted Actions를 사용하며 별도 유료 메일 서비스를 만들지 않습니다.

## 경고 기준

- DB 연결/쿼리 실패: 즉시 경고. 체크 트랜잭션 대기 최대 1.5초, 쿼리 제한 2초, 트랜잭션 제한 3초.
- DB 확인 응답: 1초 초과. 워밍업 이후 외부 확인: 3초 초과.
- 최근 약 5분 API 요청이 20건 이상이면 5xx 비율 5% 이상, 또는 3초 초과 요청 비율 5% 이상. 20건 미만에서도 5xx가 3건 이상이면 경고.
- DB 크기: `pg_database_size(current_database())`가 설정 용량의 80% 이상. 기본 500MiB, `MONITORING_DB_QUOTA_MB`로 변경. Supabase 전체 디스크/WAL/egress 사용량의 대체값은 아닙니다.
- DB 직접 연결 수: Postgres `max_connections`의 80% 이상. 외부 pooler 대기열과 동일한 수치는 아닙니다.
- 서버 요청 집계는 고정 크기 메모리 버킷으로 보관합니다. 재시작·휴면 때 초기화됩니다. p95는 히스토그램 구간 상한이며 정밀한 개별 요청 백분위가 아닙니다.

## 이메일 수신

GitHub Actions 알림을 Email / failed workflows only로 켜고 의도한 인증된 수신 주소로 라우팅해야 합니다. 현재 GitHub 계정 기본 주소와 Render 계정 주소는 다르므로 임의로 변경하지 않습니다. 메일은 경고 유형이 기록된 실행 페이지 링크를 포함합니다. 경고가 계속되면 예약 실행마다 실패 알림이 반복될 수 있습니다.

`workflow_dispatch`의 `test_alert=true`는 실제 서버·DB를 손상시키지 않고 네 가지 테스트 경고를 출력한 뒤 의도적으로 실행을 실패시킵니다. 이 실행의 메일을 실제 수신함에서 확인해야 전달 검증 완료입니다. 정상 확인 실행도 별도로 통과해야 합니다.

## 읽기 전용 부하 검증

`LOAD_REPORT_PATH=/tmp/love-alarm-load-check.json node scripts/load-check.mjs`

- 실제 DB 조회가 실행되는 기존 `/api/alarms/count`를 초당 1→3→5→10회, 각 10초간 확인합니다. 최대 190건, 동시 처리 최대 5건입니다.
- 오류 1건 또는 응답 3초 초과가 발생하면 다음 부하를 중단합니다. 미완료 요청도 최대 5초 제한입니다.
- 계정·알람·메시지·결제·UBL 데이터를 생성하거나 삭제하지 않습니다. 예약 부하 테스트는 추가하지 않습니다.
- 이 결과는 작은 읽기 부하에 대한 확인입니다. 로그인·결제·알람 쓰기·광고 SDK의 처리 한계나 ‘최대 동시 사용자 수’를 보장하지 않습니다. 실제 마케팅 규모에 대한 장시간/쓰기 포화 시험은 분리된 환경에서 해야 합니다.

기존 `/health` 응답, 기존 API 호환 설정과 실제 앱 출시 상태는 변경하지 않습니다.

## 활성화 확인 — 2026-11-28

- 모니터 전용 인증을 Render 환경변수와 GitHub Actions secret에 등록했고 `MONITORING_ENABLED=true`를 적용했습니다. 비밀값과 수신 주소는 저장소에 기록하지 않습니다.
- GitHub 계정의 인증된 기본 이메일에 Actions 실패 알림이 켜진 것을 확인했습니다.
- [정상 운영 상태 확인](https://github.com/pretotyper-sth/love-alarm/actions/runs/46138617783)이 실제 DB 집계를 조회해 통과했습니다.
- [모의 경고](https://github.com/pretotyper-sth/love-alarm/actions/runs/46138674927)를 실행하고, 해당 실행 링크와 ‘실제 장애 아님’ 문구가 포함된 메일이 의도한 계정의 받은편지함에 도착한 것을 확인했습니다. 이 실행의 failure는 메일 전달 검증을 위해 의도된 결과입니다.
- 기존 API 설정과 실제 토스 앱 출시 상태는 변경하지 않았습니다.
