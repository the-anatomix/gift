# 트리 같이 꾸미기 자동 검사

화면 없는 브라우저(Playwright Chromium)로 거실을 띄워 걷기와 화면 조건을 확인합니다.

## 준비

```bash
cd tree/tests
npm install            # 로컬 PeerJS 브로커(peer)와 playwright 를 받습니다
npx playwright install chromium
```

## 실행

```bash
node room.test.js     # 거실 · 걷기 · 길찾기 · 방 돌려 보기 · 크게 보기 · 캐릭터 고르기
node decor.test.js    # 가구 놓기·옮기기·치우기 · 트리 장식과 전구 · 벽지와 바닥 · 저장
node pov.test.js      # 1인칭 ↔ 내려다보는 시점: 둘러보기 · 걷기 · 조이스틱 · 1인칭에서 가구 놓기와 트리 꾸미기
node play.test.js     # 방 안 놀이: 다트 · TV(동영상 넣기·기억) · 마시멜로 굽기 · 오르골 · 친구에게 전해지는 것
node cake.test.js     # 케이크 만들기: 크림·장식·촛불 · 여럿이 같이 · 구경하는 사람의 촛불 불기
node door.test.js     # 초인종 입장: 집 밖 → 초인종 → 방장의 허락·돌려보내기 · 내보내기
node chat.test.js     # 채팅: 말풍선 · 지난 말 목록 · 여러 명에게 전달 · 글 다듬기와 도배 막기
node emote.test.js    # 표정과 행동: 표정 6가지 · 행동 6가지 · 1인칭에서 · 친구와 구경하는 사람에게 보이는지
node duo.test.js      # 같이 꾸미기: 방 만들기·들어가기·서로 보이기·여러 명과 구경·끊김·다시 만나 맞추기 (같은 브라우저 안 통신)
node duo.test.js --peer   # 위에 더해 로컬 PeerJS 브로커로 실제 WebRTC 데이터 채널까지
node media.test.js    # 보이스와 TV 같이 보기 (로컬 PeerJS 브로커와 가짜 마이크로 실제 WebRTC 소리·영상)
```

결과는 줄마다 `통과` / `실패` 로 나오고, 화면 사진은 `out/` 에 남습니다(커밋하지 않음).

## 검사용 주소 옵션

- `?net=bc` : PeerJS 대신 BroadcastChannel 로 잇습니다. 같은 브라우저의 탭끼리만 통합니다.
- `?ns=이름` : 저장 이름 뒤에 붙습니다. 한 브라우저 안의 두 사람이 저장을 따로 쓰게 합니다.
- `?broker=localhost:포트` : PeerJS 브로커를 로컬 것으로 바꿉니다(localhost 만 허용).
- `?door=0` : 초인종과 방장의 허락 없이 바로 들어옵니다.
- `?cap=명`, `?ecap=명` : 방 정원과 꾸밀 수 있는 사람 수를 줄입니다(주인 포함).
- `?ct=밀리초`, `?st=밀리초`, `?rt=밀리초` : 연결 대기 시간, 무응답 판정 시간, 다시 들어가 보는 간격을 줄입니다.

## 이 검사로 알 수 없는 것

실제 폰의 터치감과 속도, 폰↔폰 연결(특히 이동통신망에서의 WebRTC), 카카오톡·인스타그램 안 브라우저 동작은
사람이 기기로 직접 확인해야 합니다.
