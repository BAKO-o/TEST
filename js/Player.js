/**
 * Player.js — 플레이어 함선 엔티티
 *
 * Phase 1: WASD 이동, 마우스 방향 회전, Wraparound 맵 처리
 * Phase 3 확장: 모듈 부착 시 hitboxRadius 재계산 (TetrisGrid.js 에서 호출)
 * v0.5.0: getHitPolygons() — 선체+모듈 볼록 다각형 배열 반환 (정확 히트박스)
 */

class Player {
  /**
   * @param {number} worldW - 맵 너비
   * @param {number} worldH - 맵 높이
   */
  constructor(worldW, worldH) {
    this.worldW = worldW;
    this.worldH = worldH;

    // ── 월드 좌표 (맵 중앙에서 시작)
    this.x = worldW / 2;
    this.y = worldH / 2;

    // ── 속도 벡터 (px/s)
    this.vx = 0;
    this.vy = 0;

    // ── 물리 상수
    this.accel = 520;    // 가속도 (px/s²)
    this.drag  = 0.96;   // 프레임당 속도 감쇠 계수 (자연 최대속도 ≈ 217 px/s)
    this.maxSpeed = 260; // 최대 속도 상한 (px/s)

    // ── 회전
    this.angle = 0;      // 현재 방향각 (라디안, 오른쪽=0)
    this.rotSpeed = 10;  // 각도 보간 속도 (rad/s, 높을수록 즉각 반응)

    // ── 기체 크기
    this.radius = 18;         // 기본 충돌 반지름
    this.hitboxRadius = 18;   // 모듈 부착 후 재계산되는 실제 충돌 반지름

    // ── HP 시스템
    this.maxHp = 100;
    this.hp    = 100;
    this.invincibleTime = 0; // 피격 후 무적 시간(s), 깜빡임 효과용

    // ── 레벨 / XP
    this.level   = 1;
    this.xp      = 0;
    this.xpToNext = 100; // 다음 레벨까지 필요 XP

    // ── 스탯 배율 (업그레이드로 변경됨)
    this.speedMult     = 1.0;
    this.damageMult    = 1.0;
    this.armorReduction = 0.0; // 받는 피해 감소율 (0.0 ~ 0.75 상한)

    // ── 자원
    this.scrap = 0; // 함선 스크랩 (함체 슬롯 증설에 사용)

    // ── 화면상 위치 (Renderer에서 매 프레임 계산)
    this.screenX = 0;
    this.screenY = 0;
  }

  /**
   * 매 프레임 업데이트
   * @param {number} dt - 델타타임 (초)
   * @param {object} input - InputHandler.state
   * @param {number} screenCx - 화면 중앙 X (카메라 기준)
   * @param {number} screenCy - 화면 중앙 Y
   */
  update(dt, input, screenCx, screenCy) {
    this._applyMovement(dt, input);
    this._applyWrap();
    this._updateAngle(dt, input, screenCx, screenCy);
    if (this.invincibleTime > 0) this.invincibleTime -= dt;
  }

  /** WASD 가속·마찰 적용 */
  _applyMovement(dt, input) {
    const spd = this.accel * this.speedMult;

    if (input.up)    this.vy -= spd * dt;
    if (input.down)  this.vy += spd * dt;
    if (input.left)  this.vx -= spd * dt;
    if (input.right) this.vx += spd * dt;

    // 마찰(drag)
    this.vx *= Math.pow(this.drag, dt * 60); // 60fps 기준 정규화
    this.vy *= Math.pow(this.drag, dt * 60);

    // 최대 속도 클램프
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > this.maxSpeed * this.speedMult) {
      const scale = (this.maxSpeed * this.speedMult) / speed;
      this.vx *= scale;
      this.vy *= scale;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  /** Wraparound: 맵 경계를 넘으면 반대편으로 */
  _applyWrap() {
    this.x = ((this.x % this.worldW) + this.worldW) % this.worldW;
    this.y = ((this.y % this.worldH) + this.worldH) % this.worldH;
  }

  /**
   * 마우스 방향으로 함선 회전
   * 즉각 회전이 아닌 보간으로 자연스러운 선회 표현
   */
  _updateAngle(dt, input, screenCx, screenCy) {
    const targetAngle = Math.atan2(
      input.mouseY - screenCy,
      input.mouseX - screenCx
    );
    // 최단 각도 보간 (±π 범위 처리)
    let diff = targetAngle - this.angle;
    while (diff >  Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.angle += diff * Math.min(1, this.rotSpeed * dt);
  }

  /**
   * 피격 처리
   * @param {number} dmg - 데미지 값
   */
  takeDamage(dmg) {
    if (this.invincibleTime > 0) return; // 무적 시간 중 무시
    // 장갑 감소: armorReduction 비율만큼 피해 감소 (최대 75%)
    const armor = Math.min(0.75, this.armorReduction);
    const actualDmg = Math.max(1, dmg * (1 - armor));
    this.hp = Math.max(0, this.hp - actualDmg);
    this.invincibleTime = 0.6; // 0.6초 무적
  }

  /** XP 획득 및 레벨업 체크
   * @returns {boolean} 레벨업 발생 여부
   */
  gainXp(amount) {
    this.xp += amount;
    if (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      // 레벨에 따라 필요 XP 증가
      this.xpToNext = Math.floor(100 * Math.pow(1.35, this.level - 1));
      return true; // 레벨업!
    }
    return false;
  }

  /** 사망 여부 */
  get isDead() { return this.hp <= 0; }

  /** 화면상 중앙에 플레이어를 고정하여 그린다 */
  draw(screenCx, screenCy) {
    this.screenX = screenCx;
    this.screenY = screenCy;

    // 무적 시간 중 깜빡임 (0.1초 간격)
    const blinking = this.invincibleTime > 0 && Math.floor(this.invincibleTime / 0.1) % 2 === 0;
    if (blinking) return;

    // 부착된 모듈을 함선 아래 레이어에 먼저 그린다 (회전 적용)
    TetrisGrid.drawShipModules(Renderer.getCtx(), screenCx, screenCy, this.angle);

    // 함선 본체
    Renderer.drawPlayer(screenCx, screenCy, this.angle, this.radius);
  }

  /**
   * 충돌 판정용 볼록 다각형 배열 반환 (월드 좌표)
   * 선체 오목형 → 두 삼각형으로 분할 + 각 모듈 셀 → 직사각형 (볼록)
   * @returns {Array<Array<{x,y}>>}
   */
  getHitPolygons() {
    const cos  = Math.cos(this.angle);
    const sin  = Math.sin(this.angle);
    // 로컬 좌표 → 월드 좌표 변환 헬퍼
    const t = (lx, ly) => ({
      x: this.x + lx * cos - ly * sin,
      y: this.y + lx * sin + ly * cos,
    });

    const r = this.radius;
    // 선체 정점 (로컬: right=앞, down=오른쪽)
    // 오목형 → 삼각형 두 개로 분할
    const tri1 = [ t(r, 0), t(-r * 0.6, -r * 0.7), t(-r * 0.35, 0) ];
    const tri2 = [ t(r, 0), t(-r * 0.35, 0), t(-r * 0.6,  r * 0.7) ];
    const polys = [tri1, tri2];

    // 모듈 셀 (TetrisGrid 전역 참조)
    if (window.TetrisGrid) {
      const CELL = 22, HALF = 11;
      for (const [key, type] of TetrisGrid.getGrid()) {
        if (type === 'CORE') continue;
        const [gx, gy] = key.split(',').map(Number);
        const lx = gx * CELL, ly = gy * CELL;
        polys.push([
          t(lx - HALF, ly - HALF),
          t(lx + HALF, ly - HALF),
          t(lx + HALF, ly + HALF),
          t(lx - HALF, ly + HALF),
        ]);
      }
    }
    return polys;
  }

  /** 월드 좌표 → 화면 좌표 변환 헬퍼 (다른 엔티티가 플레이어 기준 위치 계산 시 사용) */
  worldToScreen(wx, wy, worldW, worldH) {
    let dx = wx - this.x;
    let dy = wy - this.y;
    // Wraparound 최단 경로
    if (dx >  worldW * 0.5) dx -= worldW;
    if (dx < -worldW * 0.5) dx += worldW;
    if (dy >  worldH * 0.5) dy -= worldH;
    if (dy < -worldH * 0.5) dy += worldH;
    return { sx: this.screenX + dx, sy: this.screenY + dy };
  }
}

window.Player = Player;
