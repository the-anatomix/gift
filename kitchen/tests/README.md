# 미니 주방 자동 검사

화면 없는 브라우저(Playwright Chromium)를 두세 개 띄워 "둘이 굽기"와 모바일 화면 조건을 확인합니다.

## 준비

```bash
cd kitchen/tests
npm install            # 로컬 PeerJS 브로커(peer)와 playwright 를 받습니다
npx playwright install chromium
```

## 실행

```bash
node duo.test.js            # 같은 기기 안 통신(BroadcastChannel)으로 동기화 로직 + 연결 실패 처리 + 모바일 화면
node duo.test.js --peer     # 위에 더해 로컬 PeerJS 브로커로 실제 WebRTC 데이터 채널까지
node duo.test.js --public   # 위에 더해 PeerJS 공개 브로커(0.peerjs.com)까지. 인터넷이 열려 있어야 합니다
```

자리별 검사도 같은 방식으로 따로 돌립니다.

```bash
node dough.test.js    # 반죽
node cut.test.js      # 자르기
node oven.test.js     # 굽기
node pack.test.js     # 포장 · 편지 · 선물 링크 · 받는 화면
node xmode.test.js    # 혼자/둘이 고르기 · 둘이 서로 선물
node title.test.js    # 과자 등급 · PERFECT/GOOD 판정 · 순서 안내
node brag.test.js     # 자랑 카드 · 만든 과정 사진
```

결과는 줄마다 `통과` / `실패` 로 나오고, 화면 사진은 `out/` 에 남습니다(커밋하지 않음).

## 검사용 주소 옵션

- `?net=bc` : PeerJS 대신 BroadcastChannel 로 잇습니다. 같은 브라우저의 탭끼리만 통합니다.
- `?broker=localhost:포트` : PeerJS 브로커를 로컬 것으로 바꿉니다(localhost 만 허용).
- `?ct=밀리초`, `?st=밀리초` : 연결 대기 시간, 무응답 판정 시간을 줄입니다.

## 이 검사로 알 수 없는 것

실제 폰의 터치감, 폰↔폰 연결(특히 이동통신망에서의 WebRTC), 카카오톡·인스타그램 안 브라우저 동작은
사람이 기기로 직접 확인해야 합니다.
