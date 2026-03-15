/**
 * WeaponSystem.js — 무기 자동 발사 & 투사체 풀 관리
 *
 * Phase 2: 사거리 내 최근접 적을 자동 타겟팅하여 투사체를 발사.
 * Object Pooling으로 최대 MAX_PROJECTILES 개 관리.
 * Phase 4 확장: 속성(FIRE/LASER/ELECTRIC 등) 추가 예정.
 */

const WeaponSystem = (() => {

  // ── 상수 (자동 무기)
  const MAX_PROJECTILES = 500;
  const PROJ_RADIUS     = 5;
  const PROJ_SPEED      = 420;   // 투사체 속도 (px/s)
  const PROJ_LIFETIME   = 2.2;   // 투사체 최대 생존 시간 (s)
  const PROJ_DAMAGE     = 1;     // 기본 데미지

  // ── 상수 (수동 포탄)
  const CANNON_RADIUS   = 14;    // 포탄 반지름 (px)
  const CANNON_SPEED    = 260;   // 포탄 속도 (px/s)
  const CANNON_DAMAGE   = 5;     // 포탄 직격 데미지
  const CANNON_SPLASH_R = 65;    // 범위폭발 반지름 (px)
  const CANNON_LIFETIME = 2.8;   // 포탄 최대 생존 시간 (s)
  const CANNON_COOLDOWN = 1.5;   // 포탄 재사용 대기 (s)

  // 기본 무기 스탯
  const DEFAULT_WEAPON = {
    cooldown: 0.72,    // 발사 쿨다운 (s)
    range:    350,     // 사거리 (px)
    damage:   PROJ_DAMAGE,
    projColor: '#fde68a',
  };

  // ── 보조 무기 정의
  const SECONDARY_DEFS = {
    WPN_GATLING: { cooldown: 0.22, damage: 0.6,  range: 320, color: '#f87171', fire: 'multi3'  },
    WPN_SPREAD:  { cooldown: 1.0,  damage: 1.2,  range: 280, color: '#fb923c', fire: 'spread5' },
    WPN_SNIPER:  { cooldown: 2.2,  damage: 8.0,  range: 600, color: '#c4b5fd', fire: 'single'  },
    WPN_MISSILE: { cooldown: 2.8,  damage: 4.0,  range: 500, color: '#67e8f9', fire: 'homing'  },
    WPN_FLAK:    { cooldown: 1.4,  damage: 1.5,  range: 180, color: '#fde047', fire: 'flak8'   },
    WPN_ORBIT:   { cooldown: 0.0,  damage: 1.0,  range: 70,  color: '#6ee7b7', fire: 'orbit'   },
    WPN_LASER:   { cooldown: 0.15, damage: 0.4,  range: 380, color: '#60a5fa', fire: 'single'  },
    WPN_MINE:    { cooldown: 4.0,  damage: 6.0,  range: 0,   color: '#fca5a5', fire: 'mine'    },
    WPN_CHAIN:   { cooldown: 2.0,  damage: 2.5,  range: 350, color: '#f9a8d4', fire: 'chain3'  },
    WPN_NOVA:    { cooldown: 5.0,  damage: 2.0,  range: 300, color: '#c4b5fd', fire: 'nova12'  },
  };

  // ── 풀 배열
  const projectiles = [];

  // ── 보조 무기 슬롯 목록
  const secondaries = [];  // [{ type, timer, orbitAngle, orbitTimers }]

  // ── 상태
  let worldW, worldH;
  let _zoom       = 1.0;
  let fireTimer   = 0; // 자동무기 다음 발사까지 남은 시간
  let cannonTimer = 0; // 포탄 재사용 대기 시간

  // ── 플레이어 무기 슬롯 (Phase 4 확장용)
  // 현재는 단일 기본 무기만 사용
  const weapon = { ...DEFAULT_WEAPON };

  /** Projectile 오브젝트 팩토리 */
  function createProjectile() {
    return {
      active:       false,
      x: 0, y: 0,
      vx: 0, vy: 0,
      radius:       PROJ_RADIUS,
      damage:       0,
      lifetime:     0,
      color:        '#fde68a',
      type:         'auto',   // 'auto' | 'cannon'
      splashR:      0,        // 포탄 스플래시 반지름 (auto는 0)
      isHoming:     false,    // 호밍 미사일 여부
      homingTarget: null,     // 호밍 타겟 적 객체
      chainCount:   0,        // 남은 체인 횟수
    };
  }

  /** 줌 설정 (Game.js 루프에서 매 프레임 호출) */
  function setZoom(z) { _zoom = z; }

  /** 초기화 */
  function init(ww, wh) {
    worldW = ww;
    worldH = wh;
    for (let i = 0; i < MAX_PROJECTILES; i++) projectiles.push(createProjectile());
    fireTimer = 0;
  }

  /** 풀에서 비활성 투사체 꺼내기 */
  function acquireProjectile() {
    for (const p of projectiles) {
      if (!p.active) return p;
    }
    return null; // 풀 소진
  }

  /**
   * 사거리 내 최근접 활성 적 탐색
   * @param {object} player
   * @param {Array} activeEnemies
   * @returns {object|null}
   */
  function findNearestEnemy(player, activeEnemies) {
    let nearest  = null;
    let minDistSq = weapon.range * weapon.range;

    for (const e of activeEnemies) {
      const distSq = Collision.wrappedDistSq(player.x, player.y, e.x, e.y, worldW, worldH);
      if (distSq < minDistSq) {
        minDistSq = distSq;
        nearest   = e;
      }
    }
    return nearest;
  }

  /**
   * 포탄 발사 (마우스 클릭 시 — 함선 방향으로 범위공격)
   * @param {object} player
   */
  function fireCannon(player) {
    const p = acquireProjectile();
    if (!p) return;

    p.active   = true;
    p.x        = player.x;
    p.y        = player.y;
    p.vx       = Math.cos(player.angle) * CANNON_SPEED;
    p.vy       = Math.sin(player.angle) * CANNON_SPEED;
    p.radius   = CANNON_RADIUS;
    p.damage   = CANNON_DAMAGE * player.damageMult;
    p.lifetime = CANNON_LIFETIME;
    p.color    = '#fb923c';
    p.type     = 'cannon';
    p.splashR  = CANNON_SPLASH_R;
  }

  /**
   * 자동무기 투사체 발사
   * @param {object} player
   * @param {object} target - 타겟 적
   */
  function fire(player, target) {
    const p = acquireProjectile();
    if (!p) return;

    const { dx, dy } = Collision.wrappedDelta(player.x, player.y, target.x, target.y, worldW, worldH);
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return;

    p.active   = true;
    p.x        = player.x;
    p.y        = player.y;
    p.vx       = (dx / dist) * PROJ_SPEED;
    p.vy       = (dy / dist) * PROJ_SPEED;
    p.radius   = PROJ_RADIUS;
    p.damage   = weapon.damage * player.damageMult;
    p.lifetime = PROJ_LIFETIME;
    p.color    = weapon.projColor;
    p.type     = 'auto';
    p.splashR  = 0;
  }

  /**
   * 보조 무기 장착 (TetrisGrid._applyBonus에서 호출)
   */
  function addSecondary(type) {
    secondaries.push({ type, timer: 0, orbitAngle: 0, orbitTimers: [0, 0, 0] });
  }

  /**
   * 단일 보조 무기 발사 헬퍼
   */
  function _fireSecondary(sec, def, player, target, activeEnemies) {
    const fire = def.fire;

    if (fire === 'single') {
      const p = acquireProjectile(); if (!p || !target) return;
      const { dx, dy } = Collision.wrappedDelta(player.x, player.y, target.x, target.y, worldW, worldH);
      const dist = Math.hypot(dx, dy); if (dist === 0) return;
      p.active = true; p.x = player.x; p.y = player.y;
      p.vx = (dx/dist) * PROJ_SPEED; p.vy = (dy/dist) * PROJ_SPEED;
      p.radius = PROJ_RADIUS; p.damage = def.damage * player.damageMult;
      p.lifetime = PROJ_LIFETIME; p.color = def.color;
      p.type = 'auto'; p.splashR = 0; p.isHoming = false; p.chainCount = 0;

    } else if (fire === 'multi3') {
      const targets = activeEnemies
        .filter(e => e.active)
        .map(e => ({ e, dsq: Collision.wrappedDistSq(player.x, player.y, e.x, e.y, worldW, worldH) }))
        .filter(t => t.dsq < def.range * def.range)
        .sort((a, b) => a.dsq - b.dsq)
        .slice(0, 3);
      for (const { e: t } of targets) {
        const p = acquireProjectile(); if (!p) break;
        const { dx, dy } = Collision.wrappedDelta(player.x, player.y, t.x, t.y, worldW, worldH);
        const dist = Math.hypot(dx, dy); if (dist === 0) continue;
        p.active = true; p.x = player.x; p.y = player.y;
        p.vx = (dx/dist) * PROJ_SPEED * 1.3; p.vy = (dy/dist) * PROJ_SPEED * 1.3;
        p.radius = PROJ_RADIUS; p.damage = def.damage * player.damageMult;
        p.lifetime = PROJ_LIFETIME; p.color = def.color;
        p.type = 'auto'; p.splashR = 0; p.isHoming = false; p.chainCount = 0;
      }

    } else if (fire === 'spread5') {
      if (!target) return;
      const { dx, dy } = Collision.wrappedDelta(player.x, player.y, target.x, target.y, worldW, worldH);
      const baseAngle = Math.atan2(dy, dx);
      const spread = Math.PI / 6;
      for (let i = -2; i <= 2; i++) {
        const p = acquireProjectile(); if (!p) break;
        const a = baseAngle + (i / 2) * spread;
        p.active = true; p.x = player.x; p.y = player.y;
        p.vx = Math.cos(a) * PROJ_SPEED; p.vy = Math.sin(a) * PROJ_SPEED;
        p.radius = PROJ_RADIUS; p.damage = def.damage * player.damageMult;
        p.lifetime = PROJ_LIFETIME * 0.75; p.color = def.color;
        p.type = 'auto'; p.splashR = 0; p.isHoming = false; p.chainCount = 0;
      }

    } else if (fire === 'homing') {
      const p = acquireProjectile(); if (!p || !target) return;
      const { dx, dy } = Collision.wrappedDelta(player.x, player.y, target.x, target.y, worldW, worldH);
      const dist = Math.hypot(dx, dy); if (dist === 0) return;
      p.active = true; p.x = player.x; p.y = player.y;
      p.vx = (dx/dist) * PROJ_SPEED * 0.8; p.vy = (dy/dist) * PROJ_SPEED * 0.8;
      p.radius = PROJ_RADIUS + 3; p.damage = def.damage * player.damageMult;
      p.lifetime = PROJ_LIFETIME * 1.5; p.color = def.color;
      p.type = 'auto'; p.splashR = 0; p.isHoming = true;
      p.homingTarget = target; p.chainCount = 0;

    } else if (fire === 'flak8') {
      for (let i = 0; i < 8; i++) {
        const p = acquireProjectile(); if (!p) break;
        const a = (i / 8) * Math.PI * 2;
        p.active = true; p.x = player.x; p.y = player.y;
        p.vx = Math.cos(a) * PROJ_SPEED * 0.7; p.vy = Math.sin(a) * PROJ_SPEED * 0.7;
        p.radius = PROJ_RADIUS; p.damage = def.damage * player.damageMult;
        p.lifetime = def.range / (PROJ_SPEED * 0.7);
        p.color = def.color; p.type = 'auto'; p.splashR = 0;
        p.isHoming = false; p.chainCount = 0;
      }

    } else if (fire === 'mine') {
      const p = acquireProjectile(); if (!p) return;
      p.active = true; p.x = player.x; p.y = player.y;
      p.vx = 0; p.vy = 0;
      p.radius = 9; p.damage = def.damage * player.damageMult;
      p.lifetime = 15; p.color = def.color;
      p.type = 'cannon'; p.splashR = 60;
      p.isHoming = false; p.chainCount = 0;

    } else if (fire === 'chain3') {
      const p = acquireProjectile(); if (!p || !target) return;
      const { dx, dy } = Collision.wrappedDelta(player.x, player.y, target.x, target.y, worldW, worldH);
      const dist = Math.hypot(dx, dy); if (dist === 0) return;
      p.active = true; p.x = player.x; p.y = player.y;
      p.vx = (dx/dist) * PROJ_SPEED; p.vy = (dy/dist) * PROJ_SPEED;
      p.radius = PROJ_RADIUS; p.damage = def.damage * player.damageMult;
      p.lifetime = PROJ_LIFETIME; p.color = def.color;
      p.type = 'auto'; p.splashR = 0; p.isHoming = false;
      p.chainCount = 2;  // 2번 추가 체인

    } else if (fire === 'nova12') {
      for (let i = 0; i < 12; i++) {
        const p = acquireProjectile(); if (!p) break;
        const a = (i / 12) * Math.PI * 2;
        p.active = true; p.x = player.x; p.y = player.y;
        p.vx = Math.cos(a) * PROJ_SPEED * 0.85; p.vy = Math.sin(a) * PROJ_SPEED * 0.85;
        p.radius = PROJ_RADIUS; p.damage = def.damage * player.damageMult;
        p.lifetime = def.range / (PROJ_SPEED * 0.85);
        p.color = def.color; p.type = 'auto'; p.splashR = 0;
        p.isHoming = false; p.chainCount = 0;
      }
    }
  }

  /**
   * 체인 탄 연쇄 데미지 헬퍼
   */
  function _chainHit(x, y, damage, remaining, activeEnemies, exclude) {
    const CHAIN_R = 220;
    let nearest = null;
    let minDSq = CHAIN_R * CHAIN_R;
    for (const e of activeEnemies) {
      if (!e.active || e === exclude) continue;
      const dsq = Collision.wrappedDistSq(x, y, e.x, e.y, worldW, worldH);
      if (dsq < minDSq) { minDSq = dsq; nearest = e; }
    }
    if (!nearest) return;
    EnemyManager.damageEnemy(nearest, damage);
    if (remaining > 0) _chainHit(nearest.x, nearest.y, damage, remaining - 1, activeEnemies, nearest);
  }

  /**
   * 매 프레임 업데이트
   * @param {number} dt
   * @param {object} player
   * @param {Array}  activeEnemies - EnemyManager.getActiveEnemies()
   * @param {boolean} clicked - 이번 프레임 마우스 클릭 여부 (포탄 발사 트리거)
   */
  function update(dt, player, activeEnemies, clicked) {
    // ── 수동 포탄 발사 (마우스 클릭)
    if (cannonTimer > 0) cannonTimer -= dt;
    if (clicked && cannonTimer <= 0) {
      fireCannon(player);
      cannonTimer = CANNON_COOLDOWN;
    }

    // ── 자동 발사
    fireTimer -= dt;
    if (fireTimer <= 0) {
      const target = findNearestEnemy(player, activeEnemies);
      if (target) {
        fire(player, target);
        fireTimer = weapon.cooldown;
      } else {
        fireTimer = 0.05; // 타겟 없을 때 빠른 재탐색
      }
    }

    // ── 보조 무기 업데이트
    for (const sec of secondaries) {
      const def = SECONDARY_DEFS[sec.type];
      if (!def) continue;

      if (def.fire === 'orbit') {
        // 궤도 탄: 투사체 풀 미사용, 직접 위치 계산 & 충돌
        sec.orbitAngle += dt * 2.2;
        const orbitR = Math.max(def.range, player.hitboxRadius + 15);
        for (let i = 0; i < 3; i++) {
          if (sec.orbitTimers[i] > 0) { sec.orbitTimers[i] -= dt; continue; }
          const a = sec.orbitAngle + (i * Math.PI * 2 / 3);
          const ox = player.x + Math.cos(a) * orbitR;
          const oy = player.y + Math.sin(a) * orbitR;
          for (const e of activeEnemies) {
            if (!e.active) continue;
            const { dx, dy } = Collision.wrappedDelta(ox, oy, e.x, e.y, worldW, worldH);
            if (Math.hypot(dx, dy) < e.radius + 10) {
              EnemyManager.damageEnemy(e, def.damage * player.damageMult);
              sec.orbitTimers[i] = 0.5;
              break;
            }
          }
        }
        continue;
      }

      // 쿨다운 감소
      if (sec.timer > 0) { sec.timer -= dt; continue; }

      // 타겟 탐색
      let target = null;
      if (def.range > 0) {
        let minDSq = def.range * def.range;
        for (const e of activeEnemies) {
          if (!e.active) continue;
          const dsq = Collision.wrappedDistSq(player.x, player.y, e.x, e.y, worldW, worldH);
          if (dsq < minDSq) { minDSq = dsq; target = e; }
        }
        if (!target && def.fire !== 'mine') continue;
      }

      _fireSecondary(sec, def, player, target, activeEnemies);
      sec.timer = def.cooldown;
    }

    // ── 투사체 이동 & 충돌
    for (const p of projectiles) {
      if (!p.active) continue;

      // 호밍 탄: 타겟 방향으로 선회
      if (p.isHoming && p.homingTarget && p.homingTarget.active) {
        const { dx, dy } = Collision.wrappedDelta(p.x, p.y, p.homingTarget.x, p.homingTarget.y, worldW, worldH);
        const dist = Math.hypot(dx, dy);
        if (dist > 0) {
          const targetAngle = Math.atan2(dy, dx);
          const currentAngle = Math.atan2(p.vy, p.vx);
          let diff = targetAngle - currentAngle;
          while (diff > Math.PI)  diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const turnRate = 3.5;
          const newAngle = currentAngle + Math.sign(diff) * Math.min(Math.abs(diff), turnRate * dt);
          const speed = Math.hypot(p.vx, p.vy);
          p.vx = Math.cos(newAngle) * speed;
          p.vy = Math.sin(newAngle) * speed;
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.x = ((p.x % worldW) + worldW) % worldW;
      p.y = ((p.y % worldH) + worldH) % worldH;
      p.lifetime -= dt;

      if (p.lifetime <= 0) {
        p.active = false;
        continue;
      }

      if (p.type === 'cannon') {
        // 포탄: 범위 내 모든 적에게 스플래시 데미지 후 소멸
        let hit = false;
        for (const e of activeEnemies) {
          if (!e.active) continue;
          if (Collision.circleCircleWrapped(
            p.x, p.y, p.splashR,
            e.x, e.y, e.radius,
            worldW, worldH
          )) {
            EnemyManager.damageEnemy(e, p.damage);
            hit = true;
          }
        }
        if (hit) { p.active = false; }
      } else {
        // 자동무기: 첫 번째 충돌 적 피격 후 소멸
        for (const e of activeEnemies) {
          if (!e.active) continue;
          const hit = Collision.circleCircleWrapped(
            p.x, p.y, p.radius,
            e.x, e.y, e.radius,
            worldW, worldH
          );
          if (hit) {
            p.active = false;
            EnemyManager.damageEnemy(e, p.damage);
            // 체인 탄: 추가 연쇄 데미지
            if (p.chainCount > 0) {
              _chainHit(e.x, e.y, p.damage, p.chainCount - 1, activeEnemies, e);
            }
            break;
          }
        }
      }
    }
  }

  /** 전체 렌더링 */
  function draw(player) {
    const W = Renderer.getWidth(), H = Renderer.getHeight();
    const cullX = Math.ceil(W / _zoom / 2);
    const cullY = Math.ceil(H / _zoom / 2);

    // 투사체
    for (const p of projectiles) {
      if (!p.active) continue;
      const { sx, sy } = player.worldToScreen(p.x, p.y, worldW, worldH);
      if (sx < -cullX || sx > W + cullX || sy < -cullY || sy > H + cullY) continue;
      if (p.type === 'cannon') {
        Renderer.drawCannonball(sx, sy, p.radius);
      } else {
        Renderer.drawProjectile(sx, sy, p.radius, p.color);
      }
    }

    // 궤도 탄 렌더 (WPN_ORBIT)
    const ctx = Renderer.getCtx();
    for (const sec of secondaries) {
      if (sec.type !== 'WPN_ORBIT') continue;
      const def = SECONDARY_DEFS['WPN_ORBIT'];
      const { sx: pcx, sy: pcy } = player.worldToScreen(player.x, player.y, worldW, worldH);
      const orbitR = Math.max(SECONDARY_DEFS['WPN_ORBIT'].range, player.hitboxRadius + 15);
      for (let i = 0; i < 3; i++) {
        const a = sec.orbitAngle + (i * Math.PI * 2 / 3);
        const osx = pcx + Math.cos(a) * orbitR;
        const osy = pcy + Math.sin(a) * orbitR;
        ctx.beginPath();
        ctx.arc(osx, osy, 8, 0, Math.PI * 2);
        ctx.fillStyle = def.color;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(osx, osy, 12, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(110,231,183,0.2)';
        ctx.fill();
      }
    }
  }

  /** 무기 업그레이드 (Phase 4 에서 확장) */
  function upgradeWeapon(key, value) {
    if (key in weapon) weapon[key] = value;
  }

  /** 리셋 */
  function reset(ww, wh) {
    worldW = ww; worldH = wh;
    _zoom = 1.0;
    for (const p of projectiles) p.active = false;
    fireTimer        = 0;
    cannonTimer      = 0;
    secondaries.length = 0;
    Object.assign(weapon, DEFAULT_WEAPON);
  }

  /** 현재 무기 스탯 읽기 (Game.js 업그레이드 계산용) */
  function getWeaponStat(key) { return weapon[key]; }

  return { init, update, draw, upgradeWeapon, getWeaponStat, addSecondary, reset, setZoom };
})();

window.WeaponSystem = WeaponSystem;
