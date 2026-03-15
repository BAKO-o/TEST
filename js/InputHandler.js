/**
 * InputHandler.js — 입력 관리 모듈
 * WASD 키보드 상태, 마우스 위치·방향각을 추적한다.
 * 다른 모듈은 InputHandler.state 객체를 읽기만 한다 (폴링 방식).
 */

const InputHandler = (() => {
  // 현재 입력 상태 스냅샷
  const state = {
    up: false,      // W
    down: false,    // S
    left: false,    // A
    right: false,   // D
    mouseX: 0,      // 화면 기준 마우스 X
    mouseY: 0,      // 화면 기준 마우스 Y
    mouseAngle: 0,  // 플레이어→마우스 방향각 (라디안), Game에서 매 프레임 갱신
    pause: false,        // ESC 또는 P (한 프레임만 true — 폴링 후 리셋)
    clicked: false,      // 마우스 클릭 (mousedown → true, consumeClick()으로 소비)
    skip: false,         // Space 건너뛰기 (조립 UI 전용, consumeSkip()으로 소비)
    openAssembly: false, // Q 키 — 모듈 조립화면 열기 (consumeOpenAssembly()으로 소비)
    rotate: false,       // R 키 — 조립 UI에서 모듈 회전 (consumeRotate()으로 소비)
    expand: false,       // E 키 — 조립 UI에서 함체 슬롯 증설 (consumeExpand()으로 소비)
  };

  // 키 코드 → state 필드 매핑
  const KEY_MAP = {
    KeyW: 'up',
    ArrowUp: 'up',
    KeyS: 'down',
    ArrowDown: 'down',
    KeyA: 'left',
    ArrowLeft: 'left',
    KeyD: 'right',
    ArrowRight: 'right',
  };

  function onKeyDown(e) {
    if (e.repeat) return; // 키 반복 이벤트 무시
    if (KEY_MAP[e.code]) state[KEY_MAP[e.code]] = true;
    if (e.code === 'Escape' || e.code === 'KeyP') state.pause = true;
    if (e.code === 'Space') { e.preventDefault(); state.skip = true; }
    if (e.code === 'KeyQ') state.openAssembly = true;
    if (e.code === 'KeyR') state.rotate = true;
    if (e.code === 'KeyE') state.expand = true;
  }

  function onMouseDown() {
    state.clicked = true;
  }

  function onKeyUp(e) {
    if (KEY_MAP[e.code]) state[KEY_MAP[e.code]] = false;
  }

  function onMouseMove(e) {
    state.mouseX = e.clientX;
    state.mouseY = e.clientY;
  }

  /** 초기화: 이벤트 리스너 등록 */
  function init() {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
  }

  /** 일시정지 플래그를 소비하고 반환 (한 프레임에 한 번만 true) */
  function consumePause() {
    const v = state.pause;
    state.pause = false;
    return v;
  }

  /** 클릭 플래그를 소비하고 반환 (조립 화면 클릭 감지용) */
  function consumeClick() {
    const v = state.clicked;
    state.clicked = false;
    return v;
  }

  /** Space 건너뛰기 플래그를 소비하고 반환 */
  function consumeSkip() {
    const v = state.skip;
    state.skip = false;
    return v;
  }

  /** Q키 모듈 조립화면 열기 플래그를 소비하고 반환 */
  function consumeOpenAssembly() {
    const v = state.openAssembly;
    state.openAssembly = false;
    return v;
  }

  /** R키 모듈 회전 플래그를 소비하고 반환 (조립 UI 전용) */
  function consumeRotate() {
    const v = state.rotate;
    state.rotate = false;
    return v;
  }

  /** E키 함체 슬롯 증설 플래그를 소비하고 반환 (조립 UI 전용) */
  function consumeExpand() {
    const v = state.expand;
    state.expand = false;
    return v;
  }

  return { init, state, consumePause, consumeClick, consumeSkip, consumeOpenAssembly, consumeRotate, consumeExpand };
})();

// ES Module 방식으로 전역 접근 허용
window.InputHandler = InputHandler;
