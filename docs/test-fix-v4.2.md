# Dice Match v4.2 — 전체 자동 테스트 보정

## 범위
기존 게임 기능/Cloudflare Worker는 변경하지 않습니다. 테스트 파일 2개만 수정합니다.

- tests/online-gameplay.test.js: 양쪽 플레이어의 최초 경기 WebSocket 연결을 테스트 준비 단계에서 재현한 뒤 행동/리롤 검증
- tests/online-ready-lifecycle.test.js: 종료 대상 가짜 WebSocket에 deserializeAttachment() 구현을 추가해 실제 런타임의 인터페이스를 재현

## 검증
실행: `node --test tests/*.test.js` (프로젝트 루트에서)
결과: 149개 통과, 0개 실패 (이전 v4.2 파일 + 본 수정 병합 기준)

별도의 게임 코드 변경이나 Cloudflare 재배포는 필요하지 않습니다.
실제 브라우저에서 재접속 동작은 별도 검증해야 합니다.
