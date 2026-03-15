/**
 * Renderer.js — Canvas 렌더링 헬퍼 모듈
 * 캔버스 컨텍스트를 관리하고, 자주 쓰는 draw 함수를 제공한다.
 * 외부 이미지 없이 Canvas 기본 API(arc, fillRect, beginPath 등)만 사용.
 * v0.5.0: drawEnemy() 10종 타입별 모양 분기 추가.
 */

const Renderer = (() => {
  let canvas, ctx;

  /** 초기화: canvas 엘리먼트를 받아 컨텍스트 설정 */
  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  /** 캔버스를 뷰포트 크기에 맞게 조정 */
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  /** 매 프레임 시작 시 배경 클리어 */
  function clear() {
    ctx.fillStyle = '#00020c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  /** 별 배경: Game에서 stars 배열을 넘기면 그린다 */
  function drawStars(stars) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (const s of stars) {
      ctx.globalAlpha = s.alpha;
      ctx.fillRect(s.sx, s.sy, s.size, s.size);
    }
    ctx.globalAlpha = 1;
  }

  /**
   * 플레이어 함선 그리기
   * @param {number} sx - 화면 X
   * @param {number} sy - 화면 Y
   * @param {number} angle - 회전각 (라디안)
   * @param {number} radius - 함선 반지름
   * @param {boolean} shieldActive - 방어막 표시 여부 (Phase 4)
   */
  function drawPlayer(sx, sy, angle, radius, shieldActive = false) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(angle);

    // 기체 본체 — 파란 삼각형
    ctx.beginPath();
    ctx.moveTo(radius, 0);            // 앞부분 (마우스 방향)
    ctx.lineTo(-radius * 0.6, -radius * 0.7);
    ctx.lineTo(-radius * 0.35, 0);
    ctx.lineTo(-radius * 0.6, radius * 0.7);
    ctx.closePath();
    ctx.fillStyle = '#2563eb';
    ctx.fill();
    ctx.strokeStyle = '#74b9ff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 조종석 하이라이트
    ctx.beginPath();
    ctx.arc(radius * 0.2, 0, radius * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = '#93c5fd';
    ctx.fill();

    // 엔진 불꽃 (항상 표시)
    ctx.beginPath();
    ctx.moveTo(-radius * 0.35, -radius * 0.3);
    ctx.lineTo(-radius * 0.7 - Math.random() * radius * 0.3, 0);
    ctx.lineTo(-radius * 0.35, radius * 0.3);
    ctx.fillStyle = 'rgba(251,191,36,0.7)';
    ctx.fill();

    // 방어막 원 (Phase 4 시각화용)
    if (shieldActive) {
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.4, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(96,165,250,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * 적 그리기 — 타입별 10가지 형태
   * @param {number} sx, sy - 화면 좌표
   * @param {number} angle - 이동 방향각
   * @param {number} radius - 적 반지름
   * @param {number} hpRatio - HP 비율 (0~1)
   * @param {string} type - 적 타입 키
   * @param {number} shadeAlpha - SHADE 타입 투명도 (0~1)
   */
  function drawEnemy(sx, sy, angle, radius, hpRatio = 1, type = 'DRONE', shadeAlpha = 1) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(angle);

    switch (type) {
      // ── 구형 타입 (하위 호환)
      case 'RAIDER':     _drawRaider(radius, hpRatio);                    break;
      // ── Tier 1
      case 'DRONE':      _drawDrone(radius, hpRatio);                     break;
      case 'RUSHER':     _drawRusher(radius, hpRatio);                    break;
      // ── Tier 2
      case 'SWARM':      _drawSwarm(radius, hpRatio);                     break;
      case 'ZIGZAGGER':  _drawZigzagger(radius, hpRatio);                 break;
      // ── Tier 3
      case 'GRUNT':      _drawGrunt(radius, hpRatio);                     break;
      case 'DASHER':     _drawDasher(radius, hpRatio);                    break;
      // ── Tier 4
      case 'LANCER':     _drawLancer(radius, hpRatio);                    break;
      case 'SHADE':      _drawShade(radius, hpRatio, shadeAlpha);         break;
      // ── Tier 5
      case 'BRUTE':      _drawBrute(radius, hpRatio);                     break;
      case 'BOMBER':     _drawBomber(radius, hpRatio);                    break;
      // ── Tier 6
      case 'SPLITTER':   _drawSplitter(radius, hpRatio);                  break;
      case 'SENTINEL':   _drawSentinel(radius, hpRatio);                  break;
      // ── Tier 7
      case 'PHANTOM':    _drawPhantom(radius, hpRatio, shadeAlpha);       break;
      case 'RAVAGER':    _drawRavager(radius, hpRatio);                   break;
      // ── Tier 8
      case 'JUGGERNAUT': _drawJuggernaut(radius, hpRatio);                break;
      case 'WRAITH':     _drawWraith(radius, hpRatio, shadeAlpha);        break;
      // ── Tier 9
      case 'ANCHOR':     _drawAnchor(radius, hpRatio);                    break;
      case 'ELITE':      _drawElite(radius, hpRatio);                     break;
      // ── Tier 10
      case 'TITAN':      _drawTitan(radius, hpRatio);                     break;
      case 'APEX':       _drawApex(radius, hpRatio);                      break;
      // ── Boss types
      case 'OVERLORD':      _drawBossOverlord(radius, hpRatio);                break;
      case 'HIVEMOTHER':    _drawBossHivemother(radius, hpRatio);               break;
      case 'DREADNOUGHT':   _drawBossDreadnought(radius, hpRatio);              break;
      case 'SPECTER_LORD':  _drawBossSpecterLord(radius, hpRatio, shadeAlpha);  break;
      case 'COLOSSUS':      _drawBossColossus(radius, hpRatio);                 break;
      default:           _drawDrone(radius, hpRatio);                     break;
    }

    ctx.restore();
  }

  // ── 공통 헬퍼: HP로 색상 강도 조정 ──────────────────
  function _hpFlicker(hpRatio) {
    // HP가 낮을수록 약간 밝게 (위험 시 주의 강조)
    return hpRatio > 0.3 ? 1 : 0.85 + Math.sin(Date.now() * 0.01) * 0.15;
  }

  // ── 1. RAIDER (약탈자) — 붉은 마름모 ──────────────────
  function _drawRaider(r, hp) {
    const rg = Math.floor(30 + (1 - hp) * 80);
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(0, -r * 0.65);
    ctx.lineTo(-r * 0.8, 0);
    ctx.lineTo(0, r * 0.65);
    ctx.closePath();
    ctx.fillStyle = `rgb(220,${rg},30)`;
    ctx.fill();
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // ── 2. JUGGERNAUT (중장갑함) — 짙은 회색 육각형 ─────────
  function _drawJuggernaut(r, hp) {
    const bright = Math.floor(80 + (1 - hp) * 40);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      if (i === 0) ctx.moveTo(r * Math.cos(a), r * Math.sin(a));
      else         ctx.lineTo(r * Math.cos(a), r * Math.sin(a));
    }
    ctx.closePath();
    ctx.fillStyle = `rgb(${bright},${bright},${bright + 10})`;
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.stroke();
    // 장갑판 표시선
    ctx.beginPath();
    ctx.moveTo(-r * 0.4, -r * 0.4); ctx.lineTo(r * 0.4, 0);
    ctx.moveTo(-r * 0.4, r * 0.4);  ctx.lineTo(r * 0.4, 0);
    ctx.strokeStyle = 'rgba(150,180,200,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // ── 3. SWARM (군집체) — 작은 청록 삼각형 ─────────────────
  function _drawSwarm(r, hp) {
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(-r * 0.8, -r * 0.8);
    ctx.lineTo(-r * 0.8, r * 0.8);
    ctx.closePath();
    ctx.fillStyle = hp > 0.5 ? '#22d3ee' : '#67e8f9';
    ctx.fill();
    ctx.strokeStyle = '#a5f3fc';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // ── 4. LANCER (돌격창) — 주황 세장형 화살촉 ─────────────
  function _drawLancer(r, hp) {
    const g = Math.floor(100 + (1 - hp) * 50);
    ctx.beginPath();
    ctx.moveTo(r * 1.8, 0);
    ctx.lineTo(-r * 0.5, -r * 0.4);
    ctx.lineTo(-r * 0.7, 0);
    ctx.lineTo(-r * 0.5, r * 0.4);
    ctx.closePath();
    ctx.fillStyle = `rgb(240,${g},20)`;
    ctx.fill();
    ctx.strokeStyle = '#fdba74';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // ── 5. ANCHOR (방파제) — 매우 큰 암적색 사각형 ───────────
  function _drawAnchor(r, hp) {
    const dark = Math.floor(60 + (1 - hp) * 30);
    const half = r * 0.85;
    ctx.fillStyle = `rgb(${dark + 30},${dark},${dark})`;
    ctx.fillRect(-half, -half, half * 2, half * 2);
    // 십자 보강재
    ctx.strokeStyle = `rgba(180,50,50,0.6)`;
    ctx.lineWidth = 3;
    ctx.strokeRect(-half, -half, half * 2, half * 2);
    ctx.beginPath();
    ctx.moveTo(0, -half); ctx.lineTo(0, half);
    ctx.moveTo(-half, 0); ctx.lineTo(half, 0);
    ctx.strokeStyle = 'rgba(160,30,30,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // ── 6. ZIGZAGGER (지그재그) — 노란 번개 모양 ─────────────
  function _drawZigzagger(r, hp) {
    const b = Math.floor(50 + (1 - hp) * 40);
    ctx.beginPath();
    // 번개볼트형 폴리곤
    ctx.moveTo(r * 0.6, -r);
    ctx.lineTo(-r * 0.1, -r * 0.1);
    ctx.lineTo(r * 0.5, -r * 0.1);
    ctx.lineTo(-r * 0.6, r);
    ctx.lineTo(r * 0.1, r * 0.1);
    ctx.lineTo(-r * 0.5, r * 0.1);
    ctx.closePath();
    ctx.fillStyle = `rgb(234,${179 + b},8)`;
    ctx.fill();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // ── 7. DASHER (돌진형) — 마젠타 유선형 ───────────────────
  function _drawDasher(r, hp) {
    const pulse = 0.7 + 0.3 * Math.sin(Date.now() * 0.008);
    ctx.beginPath();
    ctx.moveTo(r * 1.3, 0);
    ctx.lineTo(-r * 0.3, -r * 0.55);
    ctx.lineTo(-r * 0.9, -r * 0.2);
    ctx.lineTo(-r * 0.9, r * 0.2);
    ctx.lineTo(-r * 0.3, r * 0.55);
    ctx.closePath();
    ctx.fillStyle = `rgba(217,70,239,${pulse})`;
    ctx.fill();
    ctx.strokeStyle = '#f0abfc';
    ctx.lineWidth = 1;
    ctx.stroke();
    // 속도선
    ctx.strokeStyle = 'rgba(240,171,252,0.35)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, -r * 0.15 * i);
      ctx.lineTo(-r * 0.4 - r * 0.4 * (i / 3), -r * 0.15 * i);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, r * 0.15 * i);
      ctx.lineTo(-r * 0.4 - r * 0.4 * (i / 3), r * 0.15 * i);
      ctx.stroke();
    }
  }

  // ── 8. SHADE (암영체) — 반투명 남색 유령 ─────────────────
  function _drawShade(r, hp, shadeAlpha) {
    ctx.globalAlpha = shadeAlpha;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(r * 0.2, -r * 0.9);
    ctx.lineTo(-r * 0.6, -r * 0.7);
    ctx.lineTo(-r * 0.9, 0);
    ctx.lineTo(-r * 0.6, r * 0.7);
    ctx.lineTo(r * 0.2, r * 0.9);
    ctx.closePath();
    ctx.fillStyle = `rgba(67,56,202,0.9)`;
    ctx.fill();
    ctx.strokeStyle = `rgba(165,180,252,0.7)`;
    ctx.lineWidth = 1;
    ctx.stroke();
    // 중심 글로우
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(165,180,252,0.4)';
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ── 9. BOMBER (자폭체) — 주황 원형 + 링 ─────────────────
  function _drawBomber(r, hp) {
    const pulse = 0.55 + 0.45 * Math.sin(Date.now() * 0.005);
    // 외부 글로우 링
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(251,146,60,${pulse * 0.25})`;
    ctx.fill();
    // 본체 원
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    const g = Math.floor(80 + (1 - hp) * 30);
    ctx.fillStyle = `rgb(239,${g},30)`;
    ctx.fill();
    ctx.strokeStyle = '#fed7aa';
    ctx.lineWidth = 2;
    ctx.stroke();
    // 십자 퓨즈 표시
    ctx.strokeStyle = 'rgba(255,200,100,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, 0); ctx.lineTo(r * 0.5, 0);
    ctx.moveTo(0, -r * 0.5); ctx.lineTo(0, r * 0.5);
    ctx.stroke();
  }

  // ── 10. SPLITTER (분열체) — 초록 분열 마름모 ─────────────
  function _drawSplitter(r, hp) {
    const g = Math.floor(150 + (1 - hp) * 50);
    // 외부 마름모
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(0, -r * 0.8);
    ctx.lineTo(-r * 0.9, 0);
    ctx.lineTo(0, r * 0.8);
    ctx.closePath();
    ctx.fillStyle = `rgb(20,${g},40)`;
    ctx.fill();
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // 분열 균열선 (중앙 대각)
    ctx.strokeStyle = 'rgba(74,222,128,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-r * 0.8, 0); ctx.lineTo(r * 0.8, 0);
    ctx.moveTo(0, -r * 0.6); ctx.lineTo(0, r * 0.6);
    ctx.stroke();
    // 내부 소형 마름모 (분열될 것임을 암시)
    ctx.beginPath();
    ctx.moveTo(r * 0.35, 0);
    ctx.lineTo(0, -r * 0.3);
    ctx.lineTo(-r * 0.35, 0);
    ctx.lineTo(0, r * 0.3);
    ctx.closePath();
    ctx.fillStyle = 'rgba(134,239,172,0.5)';
    ctx.fill();
  }

  // ── 11. DRONE (정찰형) — 작고 어두운 붉은 마름모 ─────────
  function _drawDrone(r, hp) {
    const rg = Math.floor(80 + (1 - hp) * 60);
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(0, -r * 0.5);
    ctx.lineTo(-r * 0.7, 0);
    ctx.lineTo(0, r * 0.5);
    ctx.closePath();
    ctx.fillStyle = `rgb(${rg + 80},${rg - 20},20)`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,80,80,0.55)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // ── 12. RUSHER (돌격형) — 밝은 청록 총알 모양 ────────────
  function _drawRusher(r, hp) {
    ctx.beginPath();
    ctx.moveTo(r * 1.5, 0);
    ctx.lineTo(r * 0.2, -r * 0.38);
    ctx.lineTo(-r * 0.8, -r * 0.18);
    ctx.lineTo(-r * 0.8, r * 0.18);
    ctx.lineTo(r * 0.2, r * 0.38);
    ctx.closePath();
    ctx.fillStyle = hp > 0.5 ? '#00d4ff' : '#7df9ff';
    ctx.fill();
    ctx.strokeStyle = '#a5f3fc';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // ── 13. GRUNT (표준 전투원) — 회색 오각형 ────────────────
  function _drawGrunt(r, hp) {
    const b = Math.floor(95 + (1 - hp) * 55);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      if (i === 0) ctx.moveTo(r * Math.cos(a), r * Math.sin(a));
      else         ctx.lineTo(r * Math.cos(a), r * Math.sin(a));
    }
    ctx.closePath();
    ctx.fillStyle = `rgb(${b},${b},${b + 18})`;
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // ── 14. BRUTE (중장갑 돌격대) — 짙은 갈색 오각형 ────────
  function _drawBrute(r, hp) {
    const d = Math.floor(55 + (1 - hp) * 35);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      if (i === 0) ctx.moveTo(r * Math.cos(a), r * Math.sin(a));
      else         ctx.lineTo(r * Math.cos(a), r * Math.sin(a));
    }
    ctx.closePath();
    ctx.fillStyle = `rgb(${d + 55},${d + 10},18)`;
    ctx.fill();
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2;
    ctx.stroke();
    // 장갑 균열선
    ctx.strokeStyle = 'rgba(200,100,20,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-r * 0.35, 0); ctx.lineTo(r * 0.35, 0);
    ctx.stroke();
  }

  // ── 15. SENTINEL (요새형) — 대형 보라-회색 이중 육각형 ────
  function _drawSentinel(r, hp) {
    const pulse = 0.55 + 0.45 * Math.sin(Date.now() * 0.003);
    // 외부 육각형
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      if (i === 0) ctx.moveTo(r * Math.cos(a), r * Math.sin(a));
      else         ctx.lineTo(r * Math.cos(a), r * Math.sin(a));
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(72,52,115,${0.78 + hp * 0.2})`;
    ctx.fill();
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 2;
    ctx.stroke();
    // 내부 소형 육각형 (박동)
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      if (i === 0) ctx.moveTo(r * 0.55 * Math.cos(a), r * 0.55 * Math.sin(a));
      else         ctx.lineTo(r * 0.55 * Math.cos(a), r * 0.55 * Math.sin(a));
    }
    ctx.closePath();
    ctx.strokeStyle = `rgba(167,139,250,${pulse})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // ── 16. PHANTOM (환영체) — 반투명 빠른 육각 다각형 ───────
  function _drawPhantom(r, hp, alpha) {
    ctx.globalAlpha = alpha * 0.88;
    ctx.beginPath();
    ctx.moveTo(r * 1.15, 0);
    ctx.lineTo(r * 0.3, -r * 0.82);
    ctx.lineTo(-r * 0.65, -r * 0.62);
    ctx.lineTo(-r * 0.9, 0);
    ctx.lineTo(-r * 0.65, r * 0.62);
    ctx.lineTo(r * 0.3, r * 0.82);
    ctx.closePath();
    ctx.fillStyle = 'rgba(25,55,185,0.88)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(147,197,253,0.75)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(147,197,253,0.35)';
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ── 17. RAVAGER (약탈자) — 레드-바이올렛 공격적 다트 ─────
  function _drawRavager(r, hp) {
    const pulse = 0.68 + 0.32 * Math.sin(Date.now() * 0.006);
    ctx.beginPath();
    ctx.moveTo(r * 1.4, 0);
    ctx.lineTo(r * 0.1, -r * 0.58);
    ctx.lineTo(-r * 0.42, -r * 0.78);
    ctx.lineTo(-r, 0);
    ctx.lineTo(-r * 0.42, r * 0.78);
    ctx.lineTo(r * 0.1, r * 0.58);
    ctx.closePath();
    ctx.fillStyle = `rgba(175,18,118,${pulse})`;
    ctx.fill();
    ctx.strokeStyle = '#f0abfc';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // ── 18. WRAITH (유령형) — 은백색 반투명 유선형 ───────────
  function _drawWraith(r, hp, alpha) {
    ctx.globalAlpha = alpha * 0.88;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.bezierCurveTo(r * 0.82, -r * 0.48, r * 0.88, r * 0.3, r * 0.28, r * 0.8);
    ctx.lineTo(0, r * 0.52);
    ctx.lineTo(-r * 0.28, r * 0.8);
    ctx.bezierCurveTo(-r * 0.88, r * 0.3, -r * 0.82, -r * 0.48, 0, -r);
    ctx.closePath();
    ctx.fillStyle = 'rgba(195,215,255,0.82)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(220,235,255,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ── 19. ELITE (정예 전투원) — 금/앰버 육각형 + 글로우 ────
  function _drawElite(r, hp) {
    const glow = 0.25 + 0.75 * hp;
    // 외부 글로우 링
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      if (i === 0) ctx.moveTo(r * 1.28 * Math.cos(a), r * 1.28 * Math.sin(a));
      else         ctx.lineTo(r * 1.28 * Math.cos(a), r * 1.28 * Math.sin(a));
    }
    ctx.closePath();
    ctx.strokeStyle = `rgba(251,191,36,${glow * 0.45})`;
    ctx.lineWidth = 3;
    ctx.stroke();
    // 본체
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      if (i === 0) ctx.moveTo(r * Math.cos(a), r * Math.sin(a));
      else         ctx.lineTo(r * Math.cos(a), r * Math.sin(a));
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(165,110,8,0.92)';
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.stroke();
    // 중앙 코어
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = '#fef08a';
    ctx.fill();
  }

  // ── 20. TITAN (타이탄) — 거대 진홍 오각형 + 이중 헤일로 ──
  function _drawTitan(r, hp) {
    const pulse = 0.45 + 0.55 * Math.sin(Date.now() * 0.0016);
    // 헤일로 2중 링
    ctx.beginPath(); ctx.arc(0, 0, r * 1.42, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(220,30,30,${pulse * 0.42})`; ctx.lineWidth = 4; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 1.18, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,100,50,${pulse * 0.3})`; ctx.lineWidth = 2; ctx.stroke();
    // 본체 오각형
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      if (i === 0) ctx.moveTo(r * Math.cos(a), r * Math.sin(a));
      else         ctx.lineTo(r * Math.cos(a), r * Math.sin(a));
    }
    ctx.closePath();
    const d = Math.floor(48 + (1 - hp) * 28);
    ctx.fillStyle = `rgb(${d + 82},${d},${d})`;
    ctx.fill();
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3; ctx.stroke();
  }

  // ── 21. APEX (정점 포식자) — 청보라 팔각형 + 이중 링 + 코어
  function _drawApex(r, hp) {
    const p1 = 0.5 + 0.5 * Math.sin(Date.now() * 0.002);
    const p2 = 0.5 + 0.5 * Math.sin(Date.now() * 0.002 + 1.5);
    // 외부 박동 링들
    ctx.beginPath(); ctx.arc(0, 0, r * 1.52, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(139,92,246,${p1 * 0.5})`; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 1.22, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(167,139,250,${p2 * 0.38})`; ctx.lineWidth = 2; ctx.stroke();
    // 팔각형 본체
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      if (i === 0) ctx.moveTo(r * Math.cos(a), r * Math.sin(a));
      else         ctx.lineTo(r * Math.cos(a), r * Math.sin(a));
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(50,15,95,0.95)';
    ctx.fill();
    ctx.strokeStyle = '#c4b5fd'; ctx.lineWidth = 2; ctx.stroke();
    // 코어 글로우
    ctx.beginPath(); ctx.arc(0, 0, r * 0.33, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(196,181,253,${0.55 + p1 * 0.45})`; ctx.fill();
  }

  // ── BOSS 1. OVERLORD (지배자) — 대형 뾰족 붉은 소행성 ──────
  function _drawBossOverlord(r, hp) {
    const pulse  = 0.5 + 0.5 * Math.sin(Date.now() * 0.0015);
    const spikes = 8;
    // 외부 코로나 글로우
    ctx.beginPath(); ctx.arc(0, 0, r * 1.65, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(220,38,38,${0.10 + pulse * 0.08})`; ctx.fill();
    // 뾰족한 스타버스트 본체
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const a  = (i / (spikes * 2)) * Math.PI * 2;
      const ri = i % 2 === 0 ? r : r * 0.52;
      if (i === 0) ctx.moveTo(Math.cos(a) * ri, Math.sin(a) * ri);
      else         ctx.lineTo(Math.cos(a) * ri, Math.sin(a) * ri);
    }
    ctx.closePath();
    const d = Math.floor(40 + (1 - hp) * 20);
    ctx.fillStyle  = `rgb(${d + 160},${d},${d})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(255,${80 + Math.floor(pulse * 60)},50,0.95)`;
    ctx.lineWidth = 3; ctx.stroke();
    // 내부 코어 글로우
    ctx.beginPath(); ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,100,50,${0.45 + pulse * 0.55})`; ctx.fill();
  }

  // ── BOSS 2. HIVEMOTHER (군체 어미) — 유기체형 어두운 녹색 ─
  function _drawBossHivemother(r, hp) {
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.002);
    // 촉수형 팔 6개
    ctx.strokeStyle = `rgba(22,163,74,${0.25 + pulse * 0.22})`;
    ctx.lineWidth   = 5;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85);
      ctx.lineTo(Math.cos(a) * r * 1.62, Math.sin(a) * r * 1.62);
      ctx.stroke();
    }
    // 외부 메인 육각형
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      if (i === 0) ctx.moveTo(r * Math.cos(a), r * Math.sin(a));
      else         ctx.lineTo(r * Math.cos(a), r * Math.sin(a));
    }
    ctx.closePath();
    const g = Math.floor(70 + (1 - hp) * 40);
    ctx.fillStyle   = `rgb(10,${g + 25},20)`;
    ctx.fill();
    ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 2.5; ctx.stroke();
    // 내부 발광 육각형
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      if (i === 0) ctx.moveTo(r * 0.5 * Math.cos(a), r * 0.5 * Math.sin(a));
      else         ctx.lineTo(r * 0.5 * Math.cos(a), r * 0.5 * Math.sin(a));
    }
    ctx.closePath();
    ctx.fillStyle   = `rgba(74,222,128,${0.12 + pulse * 0.22})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(134,239,172,${0.4 + pulse * 0.45})`; ctx.lineWidth = 1.5; ctx.stroke();
    // 코어 원
    ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(74,222,128,${0.55 + pulse * 0.45})`; ctx.fill();
  }

  // ── BOSS 3. DREADNOUGHT (무적함) — 중장갑 전함 형태 ───────
  function _drawBossDreadnought(r, hp) {
    const bright = Math.floor(62 + (1 - hp) * 28);
    // 메인 함체 (8각 전함)
    ctx.beginPath();
    ctx.moveTo( r * 1.38,  0);
    ctx.lineTo( r * 0.65, -r * 0.55);
    ctx.lineTo(-r * 0.50, -r * 0.72);
    ctx.lineTo(-r * 1.08, -r * 0.52);
    ctx.lineTo(-r * 1.32,  0);
    ctx.lineTo(-r * 1.08,  r * 0.52);
    ctx.lineTo(-r * 0.50,  r * 0.72);
    ctx.lineTo( r * 0.65,  r * 0.55);
    ctx.closePath();
    ctx.fillStyle   = `rgb(${bright},${bright + 5},${bright + 18})`;
    ctx.fill();
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 3; ctx.stroke();
    // 장갑판 내부선
    ctx.strokeStyle = `rgba(148,163,184,0.32)`; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-r * 0.85, -r * 0.5); ctx.lineTo(r * 0.82, 0);
    ctx.moveTo(-r * 0.85,  r * 0.5); ctx.lineTo(r * 0.82, 0);
    ctx.stroke();
    // 좌우 포탑
    for (const sign of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(r * 0.08, sign * r * 0.44, r * 0.18, 0, Math.PI * 2);
      ctx.fillStyle   = `rgb(${bright + 22},${bright + 24},${bright + 34})`;
      ctx.fill();
      ctx.strokeStyle = '#64748b'; ctx.lineWidth = 2; ctx.stroke();
    }
    // 주포신
    ctx.beginPath();
    ctx.moveTo(r * 1.05, -r * 0.11); ctx.lineTo(r * 1.62, -r * 0.11);
    ctx.moveTo(r * 1.05,  r * 0.11); ctx.lineTo(r * 1.62,  r * 0.11);
    ctx.strokeStyle = '#475569'; ctx.lineWidth = 5; ctx.stroke();
    // 포구 강조
    ctx.beginPath();
    ctx.arc(r * 1.62, 0, r * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = '#334155'; ctx.fill();
  }

  // ── BOSS 4. SPECTER_LORD (유령 군주) — 왕관형 반투명 ──────
  function _drawBossSpecterLord(r, hp, alpha) {
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.003);
    ctx.globalAlpha = (alpha ?? 1) * (0.52 + pulse * 0.48);
    // 왕관형 외부 스파이크 (7개)
    ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const a  = (i / 14) * Math.PI * 2 - Math.PI / 2;
      const ri = i % 2 === 0 ? r * 1.38 : r * 0.80;
      if (i === 0) ctx.moveTo(Math.cos(a) * ri, Math.sin(a) * ri);
      else         ctx.lineTo(Math.cos(a) * ri, Math.sin(a) * ri);
    }
    ctx.closePath();
    ctx.fillStyle   = 'rgba(67,28,148,0.88)'; ctx.fill();
    ctx.strokeStyle = `rgba(196,181,253,${0.5 + pulse * 0.5})`; ctx.lineWidth = 2.5; ctx.stroke();
    // 내부 공허 원
    ctx.beginPath(); ctx.arc(0, 0, r * 0.46, 0, Math.PI * 2);
    ctx.fillStyle   = 'rgba(12,4,32,0.92)'; ctx.fill();
    ctx.strokeStyle = `rgba(167,139,250,${0.38 + pulse * 0.62})`; ctx.lineWidth = 2; ctx.stroke();
    // 눈 글로우
    ctx.beginPath(); ctx.arc(0, 0, r * 0.21, 0, Math.PI * 2);
    ctx.fillStyle   = `rgba(216,180,254,${0.55 + pulse * 0.45})`; ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ── BOSS 5. COLOSSUS (콜로서스) — 거대 보라 요새 ──────────
  function _drawBossColossus(r, hp) {
    const pulse = 0.4 + 0.6 * Math.sin(Date.now() * 0.001);
    // 외부 글로우 헤일로
    ctx.beginPath(); ctx.arc(0, 0, r * 1.75, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(109,40,217,${0.07 + pulse * 0.06})`; ctx.fill();
    // 8각 외부 요새 본체
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      if (i === 0) ctx.moveTo(r * Math.cos(a), r * Math.sin(a));
      else         ctx.lineTo(r * Math.cos(a), r * Math.sin(a));
    }
    ctx.closePath();
    const d = Math.floor(18 + (1 - hp) * 14);
    ctx.fillStyle   = `rgb(${d + 22},${d},${d + 38})`;
    ctx.fill();
    ctx.strokeStyle = '#7c3aed'; ctx.lineWidth = 4.5; ctx.stroke();
    // 내부 8각형 링
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      if (i === 0) ctx.moveTo(r * 0.62 * Math.cos(a), r * 0.62 * Math.sin(a));
      else         ctx.lineTo(r * 0.62 * Math.cos(a), r * 0.62 * Math.sin(a));
    }
    ctx.closePath();
    ctx.strokeStyle = `rgba(139,92,246,${0.38 + pulse * 0.42})`; ctx.lineWidth = 2; ctx.stroke();
    // 코어 글로우
    ctx.beginPath(); ctx.arc(0, 0, r * 0.26, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(167,139,250,${0.38 + pulse * 0.62})`; ctx.fill();
    // 4방향 크리스탈 돌기
    for (let i = 0; i < 4; i++) {
      const a  = (i / 4) * Math.PI * 2;
      const cx = Math.cos(a) * r * 0.75, cy = Math.sin(a) * r * 0.75;
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.10, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(196,181,253,${0.48 + pulse * 0.52})`; ctx.fill();
    }
  }

  /**
   * 보스 투사체 그리기 (강렬한 글로우 + 코어)
   */
  function drawBossProjectile(sx, sy, radius, color) {
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.beginPath(); ctx.arc(sx, sy, radius * 2.6, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    ctx.globalAlpha = 0.48;
    ctx.beginPath(); ctx.arc(sx, sy, radius * 1.65, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.72)';
    ctx.lineWidth   = 1.5; ctx.stroke();
    ctx.restore();
  }

  /**
   * 보스 체력바 (화면 하단 중앙, zoom 미적용 UI 공간에 렌더)
   * @param {string} type - 보스 타입 키
   * @param {number} hp
   * @param {number} maxHp
   */
  function drawBossHpBar(type, hp, maxHp) {
    const W = canvas.width, H = canvas.height;
    const barW  = Math.min(480, W * 0.52);
    const barH  = 18;
    const bx    = (W - barW) / 2;
    const by    = H - 56;
    const ratio = Math.max(0, Math.min(1, hp / maxHp));

    const BOSS_NAMES = {
      OVERLORD:    '오버로드',    HIVEMOTHER: '하이브마더',
      DREADNOUGHT: '드레드노트',  SPECTER_LORD: '스펙터 군주',
      COLOSSUS:    '콜로서스',
    };
    const BOSS_COLORS = {
      OVERLORD:    '#ef4444',    HIVEMOTHER: '#4ade80',
      DREADNOUGHT: '#94a3b8',   SPECTER_LORD: '#a78bfa',
      COLOSSUS:    '#7c3aed',
    };
    const color = BOSS_COLORS[type] ?? '#ef4444';
    const name  = BOSS_NAMES[type]  ?? type;

    ctx.save();
    // 배경 패널
    ctx.fillStyle = 'rgba(0,0,0,0.68)';
    ctx.fillRect(bx - 8, by - 30, barW + 16, barH + 42);
    // 보스 이름
    ctx.fillStyle     = color;
    ctx.font          = 'bold 13px sans-serif';
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'bottom';
    ctx.fillText(`⚡ ${name}`, W / 2, by - 5);
    // HP 트랙
    ctx.fillStyle = 'rgba(30,30,50,0.95)';
    ctx.fillRect(bx, by, barW, barH);
    // HP 채움
    ctx.fillStyle = color;
    ctx.fillRect(bx, by, barW * ratio, barH);
    // 50% 페이즈 경계선
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = 'rgba(255,255,255,0.32)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(bx + barW * 0.5, by); ctx.lineTo(bx + barW * 0.5, by + barH);
    ctx.stroke();
    ctx.restore();
    // 테두리
    ctx.strokeStyle = 'rgba(200,200,220,0.45)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, barW, barH);
    ctx.restore();
  }

  /**
   * 투사체 그리기 (작은 빛나는 원)
   * @param {number} sx - 화면 X
   * @param {number} sy - 화면 Y
   * @param {number} radius - 투사체 반지름
   * @param {string} color - 색상 (기본: 노란빛)
   */
  function drawProjectile(sx, sy, radius, color = '#fde68a') {
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    // 글로우 효과
    ctx.beginPath();
    ctx.arc(sx, sy, radius * 1.8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(253,230,138,0.22)';
    ctx.fill();
  }

  /**
   * XP 젬 그리기 (작은 다이아몬드)
   * @param {number} sx - 화면 X
   * @param {number} sy - 화면 Y
   */
  function drawXpGem(sx, sy) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 0);
    ctx.lineTo(0, 6);
    ctx.lineTo(-4, 0);
    ctx.closePath();
    ctx.fillStyle = '#34d399';
    ctx.fill();
    ctx.strokeStyle = '#6ee7b7';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * 포탄 그리기 (크고 주황빛 나는 원)
   * @param {number} sx - 화면 X
   * @param {number} sy - 화면 Y
   * @param {number} radius - 포탄 반지름
   */
  function drawCannonball(sx, sy, radius) {
    // 핵심 원
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#fb923c';
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // 글로우
    ctx.beginPath();
    ctx.arc(sx, sy, radius * 2.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(251,146,60,0.2)';
    ctx.fill();
  }

  /**
   * 파티클(폭발) 그리기
   * @param {object} p - particle {sx, sy, radius, alpha, color}
   */
  function drawParticle(sx, sy, radius, alpha, color) {
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /**
   * 모듈 드랍 아이템 렌더
   * @param {number} sx - 화면 X
   * @param {number} sy - 화면 Y
   * @param {string} moduleType - 모듈 타입 키 (WPN_ 으로 시작하면 무기)
   */
  function drawModuleDrop(sx, sy, moduleType) {
    const isWeapon = moduleType.startsWith('WPN_');
    ctx.save();
    // 외부 글로우
    ctx.beginPath();
    ctx.arc(sx, sy, 14, 0, Math.PI * 2);
    ctx.fillStyle = isWeapon ? 'rgba(220,38,38,0.25)' : 'rgba(14,116,144,0.25)';
    ctx.fill();
    // 내부 원
    ctx.beginPath();
    ctx.arc(sx, sy, 8, 0, Math.PI * 2);
    ctx.fillStyle = isWeapon ? '#dc2626' : '#0891b2';
    ctx.fill();
    // 아이콘
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isWeapon ? 'W' : 'M', sx, sy);
    ctx.restore();
  }

  /** 컨텍스트 직접 접근용 getter */
  function getCtx() { return ctx; }
  function getCanvas() { return canvas; }
  function getWidth() { return canvas.width; }
  function getHeight() { return canvas.height; }

  return {
    init, clear, drawStars,
    drawPlayer, drawEnemy,
    drawProjectile, drawCannonball, drawXpGem, drawParticle,
    drawModuleDrop, drawBossProjectile, drawBossHpBar,
    getCtx, getCanvas, getWidth, getHeight,
  };
})();

window.Renderer = Renderer;
