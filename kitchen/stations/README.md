# 자리 모듈 규칙

`stations/<이름>.js` 는 `export default function (kit) { ... return { ... } }` 한 개를 내보낸다.
파일 맨 위에서 자기 소품(3D 도형)을 만들고, 아래 함수들 중 필요한 것만 돌려준다.

## kit (app.js 가 넘겨 주는 도구)
- `THREE, scene, C(색), M(hex)→재질, put(geo, 색|재질, x,y,z, parent, 그림자)`, `rbox(w,h,d,r)`, `cyl(rt,rb,h,seg)`, `TOP_Y`(조리대 윗면 높이)
- `tween(ms, fn(k 0→1), done)`, `ease`, `easeBack`, `poke(ms)`(그 시간 동안 화면을 다시 그림. 도형을 움직였으면 반드시 부른다), `reduceMotion`
- `toast(글)`, `active()`(지금 이 자리인가), `go(자리)`, `repaint()`(아래 패널을 다시 만들고 카메라를 맞춤)
- `send(d)` : **상태를 바꾸는 유일한 길.** 곧바로 내 `apply(d)` 가 불리고, 둘이 굽기 중이면 상대의 `apply(d)` 도 불린다.
  d 는 작은 JSON 만. 초당 10번 이하로 보낸다(끌기 중에는 단계가 바뀔 때만).

## 돌려주는 것 (모두 선택)
- `panel(p, ui)` : 아래 패널 내용을 만든다. `ui.el(tag, cls, text)`, `ui.button(cls, text, onClick, label)`, `ui.hintEl(큰글, 작은글)`.
  줄은 `ui.el('div','row')`, 버튼 클래스는 `btn`(44px 이상). 글자는 textContent 로만 넣는다(ui 가 그렇게 한다).
- `enter()`, `leave()` : 이 자리에 들어올 때, 떠날 때.
- `down(i)`, `move(i)`, `up(i)` : 한 손가락 조작. `i = { x, y, dx, dy, ray(THREE.Ray, 주방 좌표), w, h }`.
- `apply(d)` : `send(d)` 로 온 사건을 상태와 화면에 반영한다. 같은 사건이 두 번 와도 괜찮게 만든다.
- `get()` / `set(v)` : 늦게 들어온 사람에게 통째로 넘길 상태. `set(undefined)` 는 처음 상태로.
- `view` : `{ tgt:[x,y,z], dir:[x,y,z], w, h }` 카메라 구도를 바꾸고 싶을 때.

## 지킬 것
- 한 손가락(누르기·문지르기·끌기)만. 버튼은 아래 패널에, 44px 이상.
- 가만히 있을 때는 아무것도 다시 그리지 않는다(계속 도는 애니메이션 금지).
- 도형 수를 아낀다. 그림자를 드리울 필요가 없는 작은 것은 `put(..., false)`.
- 브라우저 저장소를 쓰지 않는다. 다른 파일(app.js 등)은 고치지 않는다.
