# 트리 같이 꾸미기 자동 검사

화면 없는 브라우저(Playwright Chromium)로 거실을 띄워 걷기와 화면 조건을 확인합니다.

## 준비

```bash
cd tree/tests
npm install
npx playwright install chromium
```

## 실행

```bash
node room.test.js     # 거실 · 걷기 · 길찾기 · 방 돌려 보기 · 폰 화면
```

결과는 줄마다 `통과` / `실패` 로 나오고, 화면 사진은 `out/` 에 남습니다(커밋하지 않음).

## 이 검사로 알 수 없는 것

실제 폰의 터치감과 속도는 사람이 기기로 직접 확인해야 합니다.
