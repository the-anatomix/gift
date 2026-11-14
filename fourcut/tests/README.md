# 네 컷 사진관 자동 검사

화면 없는 브라우저(Playwright Chromium)로 혼자 찍기, 앨범에서 고르기, 둘이 찍기, 모바일 화면 조건을 확인합니다.

## 준비

```bash
cd fourcut/tests
npm install                       # playwright 를 받습니다 (이미 전역에 있으면 건너뜁니다)
npx playwright install chromium
```

## 실행

```bash
node fourcut.test.js                  # 전체 (30~40초)
SHOTS=/어떤/폴더 node fourcut.test.js   # 화면 사진과 완성 띠를 그 폴더에 남김 (기본은 out/, 커밋하지 않음)
```

결과는 줄마다 `통과` / `실패` 로 나옵니다.

- 혼자 찍기: Chromium 의 가짜 카메라(`--use-fake-device-for-media-stream`, `--use-fake-ui-for-media-stream`)로
  네 컷 찍기, 한 컷 다시 찍기, 프레임·한마디·날짜가 결과를 바꾸는지, 완성 띠 크기(1080x3240), 저장, 공유(되는 브라우저 / 안 되는 브라우저)
- 앨범: 카메라가 없을 때와 권한을 거부했을 때 "앨범에서 고르기"로 네 컷을 채우는지, 세로·가로 사진의 가운데 자르기, 카카오톡 안 브라우저 안내
- 둘이 찍기: 두 탭을 BroadcastChannel 로 이어 같이 카운트다운, 반쪽 사진 주고받기, 두 쪽 완성 띠가 픽셀까지 같은지,
  손님의 다시 찍기 부탁, 세 번째 사람, 손님이 나감 / 주인이 나감
- 모바일 화면: 폭 360·390·430 에서 가로 넘침이 없고 단추가 44px 이상인지

## 검사용 주소 옵션

- `?net=bc` : PeerJS 대신 BroadcastChannel 로 잇습니다. 같은 브라우저의 탭끼리만 통합니다.
- `?tick=밀리초` : 카운트다운 한 칸의 길이(기본 1000).
- `?broker=localhost:포트` : PeerJS 브로커를 로컬 것으로 바꿉니다(localhost 만 허용).
- `?ct=밀리초`, `?st=밀리초` : 연결 대기 시간, 무응답 판정 시간.

## 이 검사로 알 수 없는 것

실제 폰 카메라와 권한 창, 폰↔폰 연결(PeerJS 공개 브로커와 이동통신망의 WebRTC), 카카오톡·인스타그램 안 브라우저의
카메라·저장 동작, 공유 창은 사람이 기기로 직접 확인해야 합니다.
