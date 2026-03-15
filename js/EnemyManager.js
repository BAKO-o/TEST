/**
 * EnemyManager.js — 적 오브젝트 풀 & 웨이브 스폰 관리
 *
 * v0.8.0: 5의 배수 웨이브마다 보스 등장
 *   OVERLORD(w5) / HIVEMOTHER(w10) / DREADNOUGHT(w15) /
 *   SPECTER_LORD(w20) / COLOSSUS(w25) → 이후 반복·강화
 */

const EnemyManager = (() => {

  // ── 기본 상수
  const MAX_ENEMIES     = 500;
  const ENEMY_RADIUS    = 14;
  const ENEMY_SPEED_BASE = 58;
  const ENEMY_HP_BASE   = 3;
  const ENEMY_DAMAGE    = 10;
  const CONTACT_COOLDOWN = 1.2;

  const MODULE_DROP_CHANCE         = 0.15;
  const MAX_MODULE_DROPS           = 50;
  const MODULE_DROP_COLLECT_RADIUS = 40;
  const MODULE_DROP_LIFETIME       = 30;

  const SPAWN_MARGIN     = 60;
  const SPAWN_GROUP_SIZE = 4;
  const SPAWN_INTERVAL   = 0.4;
  const SPAWN_GROUP_GAP  = 2.0;

  const REST_DURATION  = 6;
  const KILL_BASE      = 12;
  const KILL_PER_WAVE  = 6;

  const MAX_GEMS        = 500;
  const DEBRIS_COUNT    = 1500;
  const MAX_BOSS_PROJS  = 150;  // 보스 투사체 풀
  const BOSS_PROJ_SPEED = 160;  // 보스 투사체 기본 속도 (px/s)

  // ── 티어별 크기 배율: 1.2^(tier-1) — 매 티어 20% 누적 증가
  // tier 1=1.0, 2=1.2, 3=1.44, 4=1.728, 5=2.074, 6=2.488, 7=2.986, 8=3.583, 9=4.300, 10=5.160
  function _tierRadiusMult(tier) { return Math.pow(1.2, tier - 1); }

  // ── 20종 일반 적 타입 (tier: minWave 그룹 → 1~10)
  const ENEMY_TYPES = {
    DRONE:      { tier:1,  radiusMult:0.55, hpMult:0.40, speedMult:0.75, damageMult:0.5, xpMult:0.4,  weight:8, behavior:'chase',    minWave:1  },
    RUSHER:     { tier:1,  radiusMult:0.50, hpMult:0.35, speedMult:2.20, damageMult:0.6, xpMult:0.5,  weight:7, behavior:'chase',    minWave:1  },
    SWARM:      { tier:2,  radiusMult:0.42, hpMult:0.30, speedMult:2.40, damageMult:0.4, xpMult:0.3,  weight:9, behavior:'chase',    minWave:4  },
    ZIGZAGGER:  { tier:2,  radiusMult:0.90, hpMult:1.00, speedMult:1.30, damageMult:0.9, xpMult:1.2,  weight:5, behavior:'zigzag',   minWave:4  },
    GRUNT:      { tier:3,  radiusMult:1.00, hpMult:1.00, speedMult:1.00, damageMult:1.0, xpMult:1.0,  weight:6, behavior:'chase',    minWave:7  },
    DASHER:     { tier:3,  radiusMult:0.85, hpMult:1.20, speedMult:0.70, damageMult:1.5, xpMult:1.5,  weight:4, behavior:'dash',     minWave:7  },
    LANCER:     { tier:4,  radiusMult:0.80, hpMult:0.90, speedMult:1.70, damageMult:1.3, xpMult:1.5,  weight:5, behavior:'chase',    minWave:10 },
    SHADE:      { tier:4,  radiusMult:1.00, hpMult:1.50, speedMult:1.00, damageMult:1.2, xpMult:2.0,  weight:3, behavior:'chase',    minWave:10 },
    BRUTE:      { tier:5,  radiusMult:1.80, hpMult:5.00, speedMult:0.60, damageMult:2.0, xpMult:3.0,  weight:3, behavior:'chase',    minWave:13 },
    BOMBER:     { tier:5,  radiusMult:1.40, hpMult:2.00, speedMult:0.70, damageMult:3.5, xpMult:2.5,  weight:3, behavior:'chase',    minWave:13 },
    SPLITTER:   { tier:6,  radiusMult:1.60, hpMult:3.00, speedMult:0.60, damageMult:1.3, xpMult:3.0,  weight:2, behavior:'splitter', minWave:16 },
    SENTINEL:   { tier:6,  radiusMult:2.00, hpMult:7.00, speedMult:0.45, damageMult:2.0, xpMult:4.0,  weight:2, behavior:'chase',    minWave:16 },
    PHANTOM:    { tier:7,  radiusMult:1.00, hpMult:2.00, speedMult:1.70, damageMult:1.8, xpMult:3.5,  weight:2, behavior:'zigzag',   minWave:19 },
    RAVAGER:    { tier:7,  radiusMult:1.20, hpMult:2.50, speedMult:1.90, damageMult:2.5, xpMult:4.0,  weight:2, behavior:'dash',     minWave:19 },
    JUGGERNAUT: { tier:8,  radiusMult:2.50, hpMult:12.0, speedMult:0.35, damageMult:3.0, xpMult:7.0,  weight:1, behavior:'chase',    minWave:22 },
    WRAITH:     { tier:8,  radiusMult:0.90, hpMult:3.00, speedMult:2.10, damageMult:2.0, xpMult:4.5,  weight:2, behavior:'dash',     minWave:22 },
    ANCHOR:     { tier:9,  radiusMult:3.00, hpMult:20.0, speedMult:0.18, damageMult:6.0, xpMult:10.0, weight:1, behavior:'chase',    minWave:26 },
    ELITE:      { tier:9,  radiusMult:1.20, hpMult:4.00, speedMult:1.50, damageMult:2.2, xpMult:5.0,  weight:2, behavior:'chase',    minWave:26 },
    TITAN:      { tier:10, radiusMult:3.50, hpMult:35.0, speedMult:0.28, damageMult:5.0, xpMult:15.0, weight:1, behavior:'chase',    minWave:30 },
    APEX:       { tier:10, radiusMult:2.00, hpMult:15.0, speedMult:1.20, damageMult:4.0, xpMult:12.0, weight:1, behavior:'dash',     minWave:30 },

    // ── 5종 보스 (tier:11, weight:0 → _randomType에서 제외, isBoss:true)
    OVERLORD:     { tier:11, radiusMult:3.8, hpMult:60,  speedMult:0.50, damageMult:3.0, xpMult:30,  weight:0, behavior:'boss', minWave:99, isBoss:true },
    HIVEMOTHER:   { tier:11, radiusMult:4.2, hpMult:80,  speedMult:0.30, damageMult:2.5, xpMult:40,  weight:0, behavior:'boss', minWave:99, isBoss:true },
    DREADNOUGHT:  { tier:11, radiusMult:4.0, hpMult:100, speedMult:0.40, damageMult:2.8, xpMult:50,  weight:0, behavior:'boss', minWave:99, isBoss:true },
    SPECTER_LORD: { tier:11, radiusMult:3.2, hpMult:70,  speedMult:1.20, damageMult:2.2, xpMult:45,  weight:0, behavior:'boss', minWave:99, isBoss:true },
    COLOSSUS:     { tier:11, radiusMult:5.0, hpMult:150, speedMult:0.20, damageMult:4.0, xpMult:60,  weight:0, behavior:'boss', minWave:99, isBoss:true },
  };

  const TYPE_KEYS  = Object.keys(ENEMY_TYPES);
  const BOSS_CYCLE = ['OVERLORD', 'HIVEMOTHER', 'DREADNOUGHT', 'SPECTER_LORD', 'COLOSSUS'];

  /** 현재 웨이브에서 등장 가능한 일반 적 중 가중치 랜덤 선택 */
  function _randomType() {
    const eligible    = TYPE_KEYS.filter(k => !ENEMY_TYPES[k].isBoss && ENEMY_TYPES[k].minWave <= waveNumber);
    const totalWeight = eligible.reduce((s, k) => s + ENEMY_TYPES[k].weight, 0);
    let r = Math.random() * totalWeight;
    for (const k of eligible) {
      r -= ENEMY_TYPES[k].weight;
      if (r <= 0) return k;
    }
    return eligible[eligible.length - 1];
  }

  /** 웨이브번호로 보스 타입 결정 */
  function _getBossType() {
    return BOSS_CYCLE[Math.floor((waveNumber / 5 - 1) % BOSS_CYCLE.length)];
  }

  // ── 풀 배열
  const enemies      = [];
  const gems         = [];
  const moduleDrops  = [];
  const debris       = [];
  const bossProjs    = [];  // 보스 전용 투사체 풀

  // ── 게임 상태
  let worldW, worldH;
  let _zoom          = 1.0;
  let waveNumber     = 1;
  let totalKills     = 0;
  let waveKills      = 0;
  let waveKillTarget = KILL_BASE;
  let isResting      = false;
  let restTimer      = 0;
  let spawnPending   = 0;
  let spawnTimer     = 0;
  let spawnSide       = 0;
  let spawnGroupCount = 0;
  let spawnGroupTimer = 0;
  let bossEnemy       = null;  // 현재 활성 보스 참조

  let _player = null;

  // ── 오브젝트 팩토리
  function createEnemy() {
    return {
      active:false, x:0, y:0, vx:0, vy:0,
      angle:0, hp:0, maxHp:0, speed:0, radius:0,
      contactCooldown:0, xpValue:0, type:'DRONE', isSplit:false,
      zigzagPhase:0, dashTimer:0, dashCooldown:0, shadeAlpha:1.0,
      tier:1, // 티어 (반경 배율·피해 면역 판정에 사용)
      // 보스 전용 필드
      isBoss:false, attackTimer:0, attackPhase:0, bossRotOffset:0, summonTimer:0,
    };
  }
  function createGem() {
    return { active:false, x:0, y:0, value:0, collectRadius:200, speed:320 };
  }
  function createModuleDrop() {
    return { active:false, x:0, y:0, moduleType:'', lifetime:0 };
  }
  function createBossProj() {
    return { active:false, x:0, y:0, vx:0, vy:0, radius:8, damage:10, lifetime:0, color:'#ef4444' };
  }

  function acquireEnemy()      { for (const e of enemies)     { if (!e.active) return e; } return null; }
  function acquireGem()        { for (const g of gems)        { if (!g.active) return g; } return null; }
  function acquireModuleDrop() { for (const d of moduleDrops) { if (!d.active) return d; } return null; }
  function acquireBossProj()   { for (const p of bossProjs)   { if (!p.active) return p; } return null; }

  /** 배경 잔해물 맵 전체 산포 */
  function _initDebris() {
    debris.length = 0;
    for (let i = 0; i < DEBRIS_COUNT; i++) {
      debris.push({
        x:     Math.random() * worldW,
        y:     Math.random() * worldH,
        angle: Math.random() * Math.PI * 2,
        size:  6 + Math.random() * 28,
        alpha: 0.05 + Math.random() * 0.13,
        shape: Math.floor(Math.random() * 4),
      });
    }
  }

  /** 초기화 */
  function init(ww, wh) {
    worldW = ww; worldH = wh;
    for (let i = 0; i < MAX_ENEMIES;      i++) enemies.push(createEnemy());
    for (let i = 0; i < MAX_GEMS;         i++) gems.push(createGem());
    for (let i = 0; i < MAX_MODULE_DROPS; i++) moduleDrops.push(createModuleDrop());
    for (let i = 0; i < MAX_BOSS_PROJS;   i++) bossProjs.push(createBossProj());
    _initDebris();
    waveKills       = 0;
    waveKillTarget  = KILL_BASE;
    isResting       = false; restTimer = 0;
    spawnPending    = waveKillTarget;
    spawnTimer      = 0; spawnSide = 0; spawnGroupCount = 0; spawnGroupTimer = 0;
    bossEnemy       = null;
  }

  function setZoom(z) { _zoom = z; }

  /** 지정 방향(side) 화면 가장자리 바깥 월드 좌표 반환 */
  function getSpawnPos(player, side) {
    const W = Renderer.getWidth(), H = Renderer.getHeight();
    let sx, sy;
    if      (side === 0) { sx = Math.random() * W; sy = -SPAWN_MARGIN; }
    else if (side === 1) { sx = Math.random() * W; sy = H + SPAWN_MARGIN; }
    else if (side === 2) { sx = -SPAWN_MARGIN;     sy = Math.random() * H; }
    else                  { sx = W + SPAWN_MARGIN;  sy = Math.random() * H; }
    let wx = player.x + (sx - player.screenX) / _zoom;
    let wy = player.y + (sy - player.screenY) / _zoom;
    wx = ((wx % worldW) + worldW) % worldW;
    wy = ((wy % worldH) + worldH) % worldH;
    return { wx, wy };
  }

  function waveScale() { return 1 + (waveNumber - 1) * 0.18; }

  function _initEnemy(e, wx, wy, typeKey, scale, isSplit) {
    const def  = ENEMY_TYPES[typeKey];
    e.active   = true;
    e.x        = ((wx % worldW) + worldW) % worldW;
    e.y        = ((wy % worldH) + worldH) % worldH;
    e.vx = 0; e.vy = 0;
    e.type     = typeKey; e.isSplit = !!isSplit;
    e.hp       = Math.ceil(ENEMY_HP_BASE * def.hpMult * scale);
    e.maxHp    = e.hp;
    e.speed    = ENEMY_SPEED_BASE * def.speedMult * (0.9 + Math.random() * 0.2) * Math.sqrt(scale);
    // 반경: 기본 × 타입 배율 × 티어 누적 배율(20%/티어, 보스 제외)
    const tierMult = def.isBoss ? 1.0 : _tierRadiusMult(def.tier);
    e.radius   = Math.ceil(ENEMY_RADIUS * def.radiusMult * tierMult);
    e.tier     = def.tier ?? 1;
    e.contactCooldown = 0;
    e.xpValue  = Math.floor(20 * def.xpMult * scale);
    e.zigzagPhase = 0; e.dashTimer = 0; e.dashCooldown = 1.0 + Math.random() * 0.8;
    e.shadeAlpha  = 1.0;
    e.isBoss = false; e.attackTimer = 0; e.attackPhase = 0;
    e.bossRotOffset = 0; e.summonTimer = 0;
  }

  /** 보스 스폰 (wave % 5 === 0 일 때 wave 시작 시 호출) */
  function spawnBoss(player) {
    const e = acquireEnemy();
    if (!e) return;
    const bossType  = _getBossType();
    const def       = ENEMY_TYPES[bossType];
    const bossRank  = Math.ceil(waveNumber / 5);  // 같은 보스 몇 번째 등장인지
    const scale     = waveScale() * bossRank;     // 등장할 때마다 점점 강해짐
    const pos       = getSpawnPos(player, 0);     // 위쪽에서 등장

    e.active  = true;
    e.x       = pos.wx; e.y = pos.wy;
    e.vx = 0; e.vy = 0;
    e.type    = bossType; e.isSplit = false; e.isBoss = true;
    e.hp      = Math.ceil(ENEMY_HP_BASE * def.hpMult * scale);
    e.maxHp   = e.hp;
    e.speed   = ENEMY_SPEED_BASE * def.speedMult * Math.sqrt(waveScale());
    e.radius  = Math.ceil(ENEMY_RADIUS * def.radiusMult);
    e.contactCooldown = 0;
    e.xpValue = Math.floor(20 * def.xpMult * scale);
    e.attackTimer   = 2.5;   // 등장 후 2.5초 뒤 첫 공격
    e.attackPhase   = 0;
    e.bossRotOffset = 0;
    e.summonTimer   = 5.0;
    e.zigzagPhase   = 0;
    e.dashTimer     = 0; e.dashCooldown = 2.0;
    e.shadeAlpha    = 1.0;

    bossEnemy = e;
  }

  /** 보스 투사체 발사 패턴 */
  function _bossFire(boss, player) {
    const { dx, dy } = Collision.wrappedDelta(boss.x, boss.y, player.x, player.y, worldW, worldH);
    const dist  = Math.hypot(dx, dy);
    const angle = dist > 0 ? Math.atan2(dy, dx) : 0;

    switch (boss.type) {

      case 'OVERLORD': {
        // Phase 0: 8방향 노바, Phase 1(HP<50%): 16방향 노바
        const count = boss.attackPhase >= 1 ? 16 : 8;
        for (let i = 0; i < count; i++) {
          const p = acquireBossProj(); if (!p) return;
          const a = (i / count) * Math.PI * 2;
          p.active=true; p.x=boss.x; p.y=boss.y;
          p.vx=Math.cos(a)*BOSS_PROJ_SPEED; p.vy=Math.sin(a)*BOSS_PROJ_SPEED;
          p.radius=9; p.damage=14; p.lifetime=4.0; p.color='#ef4444';
        }
        break;
      }

      case 'HIVEMOTHER': {
        // 플레이어 방향으로 3발 (부채꼴)
        for (let i = -1; i <= 1; i++) {
          const p = acquireBossProj(); if (!p) return;
          const a = angle + i * 0.28;
          p.active=true; p.x=boss.x; p.y=boss.y;
          p.vx=Math.cos(a)*BOSS_PROJ_SPEED*0.75; p.vy=Math.sin(a)*BOSS_PROJ_SPEED*0.75;
          p.radius=12; p.damage=12; p.lifetime=5.5; p.color='#4ade80';
        }
        // Phase 1: 추가 3발(역방향)
        if (boss.attackPhase >= 1) {
          for (let i = -1; i <= 1; i++) {
            const p = acquireBossProj(); if (!p) return;
            const a = angle + Math.PI + i * 0.28;
            p.active=true; p.x=boss.x; p.y=boss.y;
            p.vx=Math.cos(a)*BOSS_PROJ_SPEED*0.6; p.vy=Math.sin(a)*BOSS_PROJ_SPEED*0.6;
            p.radius=10; p.damage=10; p.lifetime=5.5; p.color='#86efac';
          }
        }
        break;
      }

      case 'DREADNOUGHT': {
        // 회전 포격: rotOffset이 매 발사마다 π/6씩 전진
        boss.bossRotOffset += Math.PI / 6;
        const shotCount = boss.attackPhase >= 1 ? 8 : 4;
        for (let i = 0; i < shotCount; i++) {
          const p = acquireBossProj(); if (!p) return;
          const a = boss.bossRotOffset + (i / shotCount) * Math.PI * 2;
          p.active=true; p.x=boss.x; p.y=boss.y;
          p.vx=Math.cos(a)*BOSS_PROJ_SPEED; p.vy=Math.sin(a)*BOSS_PROJ_SPEED;
          p.radius=10; p.damage=18; p.lifetime=4.5; p.color='#94a3b8';
        }
        break;
      }

      case 'SPECTER_LORD': {
        // 5방향 부채꼴, 빠른 속도
        for (let i = -2; i <= 2; i++) {
          const p = acquireBossProj(); if (!p) return;
          const a = angle + i * 0.22;
          p.active=true; p.x=boss.x; p.y=boss.y;
          p.vx=Math.cos(a)*BOSS_PROJ_SPEED*1.55; p.vy=Math.sin(a)*BOSS_PROJ_SPEED*1.55;
          p.radius=7; p.damage=10; p.lifetime=3.0; p.color='#818cf8';
        }
        // Phase 1: 반대 방향 3발 추가
        if (boss.attackPhase >= 1) {
          for (let i = -1; i <= 1; i++) {
            const p = acquireBossProj(); if (!p) return;
            const a = angle + Math.PI + i * 0.35;
            p.active=true; p.x=boss.x; p.y=boss.y;
            p.vx=Math.cos(a)*BOSS_PROJ_SPEED*1.2; p.vy=Math.sin(a)*BOSS_PROJ_SPEED*1.2;
            p.radius=7; p.damage=8; p.lifetime=3.0; p.color='#c4b5fd';
          }
        }
        break;
      }

      case 'COLOSSUS': {
        // 12방향 느리고 큰 투사체 (약간 플레이어 방향으로 치우침)
        for (let i = 0; i < 12; i++) {
          const p = acquireBossProj(); if (!p) return;
          const a = (i / 12) * Math.PI * 2 + angle * 0.05;
          p.active=true; p.x=boss.x; p.y=boss.y;
          p.vx=Math.cos(a)*BOSS_PROJ_SPEED*0.42; p.vy=Math.sin(a)*BOSS_PROJ_SPEED*0.42;
          p.radius=17; p.damage=24; p.lifetime=7.0; p.color='#7c3aed';
        }
        break;
      }
    }
  }

  /** 보스 AI 업데이트 (update loop에서 분리) */
  function _updateBoss(e, dt, player, dist, dx, dy) {
    // 페이즈 전환 체크 (HP 50% 이하 → Phase 1)
    if (e.attackPhase === 0 && e.hp < e.maxHp * 0.5) {
      e.attackPhase = 1;
      e.attackTimer = 0; // 즉시 공격
    }

    // 공격 쿨다운
    const baseCooldowns = { OVERLORD:4.0, HIVEMOTHER:5.0, DREADNOUGHT:2.8, SPECTER_LORD:1.8, COLOSSUS:5.5 };
    const baseCd = baseCooldowns[e.type] ?? 4.0;
    const cd     = e.attackPhase >= 1 ? baseCd * 0.6 : baseCd;
    e.attackTimer -= dt;
    if (e.attackTimer <= 0) {
      _bossFire(e, player);
      e.attackTimer = cd;
    }

    // 이동 AI
    if (dist > 0) {
      e.angle = Math.atan2(dy, dx);

      if (e.type === 'SPECTER_LORD') {
        // 고속 지그재그
        e.zigzagPhase += dt * 4.5;
        const px = -dy / dist, py = dx / dist;
        e.vx = (dx / dist) * e.speed + px * Math.sin(e.zigzagPhase) * 90;
        e.vy = (dy / dist) * e.speed + py * Math.sin(e.zigzagPhase) * 90;
        e.shadeAlpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(Date.now() * 0.004 + e.x * 0.005));

      } else if (e.type === 'OVERLORD' && e.attackPhase >= 1) {
        // Phase 2: 돌진 공격
        if (e.dashTimer > 0) {
          e.dashTimer -= dt;
          e.vx = (dx / dist) * e.speed * 4.2;
          e.vy = (dy / dist) * e.speed * 4.2;
        } else {
          e.dashCooldown -= dt;
          if (e.dashCooldown <= 0) { e.dashTimer = 0.28; e.dashCooldown = 2.2 + Math.random() * 0.5; }
          e.vx = (dx / dist) * e.speed;
          e.vy = (dy / dist) * e.speed;
        }

      } else {
        // 기본 직선 추적
        e.vx = (dx / dist) * e.speed;
        e.vy = (dy / dist) * e.speed;
      }
    }

    // HIVEMOTHER: 주기적 하수인 소환
    if (e.type === 'HIVEMOTHER') {
      e.summonTimer -= dt;
      if (e.summonTimer <= 0) {
        e.summonTimer = e.attackPhase >= 1 ? 3.5 : 6.0;
        const cnt = e.attackPhase >= 1 ? 5 : 3;
        for (let i = 0; i < cnt; i++) _spawnAt(e.x, e.y, 'SWARM');
      }
    }
  }

  function spawnOneFromSide(player, side) {
    const e = acquireEnemy(); if (!e) return;
    const pos = getSpawnPos(player, side);
    _initEnemy(e, pos.wx, pos.wy, _randomType(), waveScale(), false);
  }

  function _spawnAt(wx, wy, typeKey) {
    const e = acquireEnemy(); if (!e) return;
    _initEnemy(e, wx + (Math.random()-0.5)*50, wy + (Math.random()-0.5)*50, typeKey, waveScale(), true);
  }

  function _separateEnemies() {
    const active = [];
    for (const e of enemies) { if (e.active) active.push(e); }
    for (let i = 0; i < active.length; i++) {
      const a = active[i];
      for (let j = i + 1; j < active.length; j++) {
        const b = active[j];
        const { dx, dy } = Collision.wrappedDelta(a.x, a.y, b.x, b.y, worldW, worldH);
        const dist = Math.hypot(dx, dy), minDist = a.radius + b.radius;
        if (dist > 0 && dist < minDist) {
          const push = (minDist - dist) * 0.5, nx = dx/dist, ny = dy/dist;
          a.x -= nx*push; a.y -= ny*push;
          b.x += nx*push; b.y += ny*push;
          a.x=((a.x%worldW)+worldW)%worldW; a.y=((a.y%worldH)+worldH)%worldH;
          b.x=((b.x%worldW)+worldW)%worldW; b.y=((b.y%worldH)+worldH)%worldH;
        }
      }
    }
  }

  function update(dt, player) {
    _player = player;
    let didLevelUp = false;

    // ── 웨이브 킬 목표 시스템
    if (isResting) {
      restTimer -= dt;
      if (restTimer <= 0) {
        isResting = false;
        waveNumber++;
        waveKills      = 0;
        waveKillTarget = KILL_BASE + (waveNumber - 1) * KILL_PER_WAVE;
        spawnPending   = waveKillTarget;
        spawnSide = 0; spawnGroupCount = 0; spawnGroupTimer = 0;
        // 보스 웨이브면 즉시 보스 스폰
        if (waveNumber % 5 === 0) spawnBoss(player);
      }
    } else {
      if (waveKills >= waveKillTarget) {
        isResting = true; restTimer = REST_DURATION;
        for (const e of enemies) e.active = false;
        for (const p of bossProjs) p.active = false;
        bossEnemy = null;
      } else {
        if (spawnPending === 0) {
          let activeCount = 0;
          for (const e of enemies) { if (e.active) activeCount++; }
          const remaining = waveKillTarget - waveKills;
          if (activeCount < remaining) {
            spawnPending = remaining - activeCount;
            spawnGroupCount = 0; spawnGroupTimer = 0;
          }
        }
      }
    }

    // ── 방향별 순차 그룹 스폰
    if (spawnPending > 0) {
      if (spawnGroupTimer > 0) {
        spawnGroupTimer -= dt;
        if (spawnGroupTimer <= 0) {
          spawnGroupTimer = 0; spawnSide = (spawnSide + 1) % 4; spawnGroupCount = 0;
        }
      } else {
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
          spawnTimer = SPAWN_INTERVAL;
          spawnOneFromSide(player, spawnSide);
          spawnPending--; spawnGroupCount++;
          if (spawnGroupCount >= SPAWN_GROUP_SIZE && spawnPending > 0) spawnGroupTimer = SPAWN_GROUP_GAP;
        }
      }
    }

    // ── 현재 활성 적 중 최고 티어 계산 (피해 면역 판정용)
    let maxActiveTier = 0;
    for (const e of enemies) {
      if (e.active && !e.isBoss) maxActiveTier = Math.max(maxActiveTier, e.tier);
    }

    // ── 적 AI 이동 · 충돌
    const now = Date.now();
    for (const e of enemies) {
      if (!e.active) continue;
      const { dx, dy } = Collision.wrappedDelta(e.x, e.y, player.x, player.y, worldW, worldH);
      const dist = Math.hypot(dx, dy);

      if (e.isBoss) {
        _updateBoss(e, dt, player, dist, dx, dy);
      } else {
        if (dist > 0) {
          e.angle = Math.atan2(dy, dx);
          const behavior = ENEMY_TYPES[e.type]?.behavior ?? 'chase';
          if (behavior === 'zigzag') {
            e.zigzagPhase += dt * 3.5;
            const px = -dy/dist, py = dx/dist;
            const sideOff = Math.sin(e.zigzagPhase) * 60;
            e.vx = (dx/dist)*e.speed + px*sideOff; e.vy = (dy/dist)*e.speed + py*sideOff;
          } else if (behavior === 'dash') {
            if (e.dashTimer > 0) {
              e.dashTimer -= dt; e.vx = (dx/dist)*e.speed*3.5; e.vy = (dy/dist)*e.speed*3.5;
            } else {
              e.dashCooldown -= dt;
              if (e.dashCooldown <= 0) { e.dashTimer = 0.25; e.dashCooldown = 1.6 + Math.random()*0.6; }
              e.vx = (dx/dist)*e.speed*0.2; e.vy = (dy/dist)*e.speed*0.2;
            }
          } else {
            e.vx = (dx/dist)*e.speed; e.vy = (dy/dist)*e.speed;
          }
          if (e.type === 'SHADE' || e.type === 'PHANTOM' || e.type === 'WRAITH') {
            e.shadeAlpha = 0.25 + 0.75*(0.5 + 0.5*Math.sin(now*0.002 + e.x*0.01));
          }
        }
      }

      e.x += e.vx*dt; e.y += e.vy*dt;
      e.x = ((e.x%worldW)+worldW)%worldW; e.y = ((e.y%worldH)+worldH)%worldH;
      if (e.contactCooldown > 0) e.contactCooldown -= dt;
      if (e.contactCooldown <= 0) {
        const hitPolys = player.getHitPolygons();
        let hit = false;
        for (const poly of hitPolys) {
          if (Collision.polyCircleWrapped(poly, e.x, e.y, e.radius, worldW, worldH)) { hit=true; break; }
        }
        if (hit) {
          // 최고 티어보다 2 이상 낮은 티어 적은 데미지 무시 (보스는 항상 데미지)
          const isLowTier = !e.isBoss && (maxActiveTier - e.tier >= 2);
          if (!isLowTier) {
            const dmg = Math.floor(ENEMY_DAMAGE * (ENEMY_TYPES[e.type]?.damageMult ?? 1));
            TetrisGrid.hitShip(e.x, e.y, dmg, player);
          }
          e.contactCooldown = CONTACT_COOLDOWN;
          const { dx:pdx, dy:pdy } = Collision.wrappedDelta(player.x, player.y, e.x, e.y, worldW, worldH);
          const pd = Math.hypot(pdx, pdy);
          if (pd > 0) {
            const pushTo = player.radius + e.radius + 4;
            e.x = (((player.x+(pdx/pd)*pushTo)%worldW)+worldW)%worldW;
            e.y = (((player.y+(pdy/pd)*pushTo)%worldH)+worldH)%worldH;
          }
        }
      }
    }

    _separateEnemies();

    // ── 보스 투사체 이동 · 플레이어 충돌
    for (const p of bossProjs) {
      if (!p.active) continue;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.x = ((p.x%worldW)+worldW)%worldW; p.y = ((p.y%worldH)+worldH)%worldH;
      p.lifetime -= dt;
      if (p.lifetime <= 0) { p.active = false; continue; }
      const { dx, dy } = Collision.wrappedDelta(p.x, p.y, player.x, player.y, worldW, worldH);
      if (Math.hypot(dx, dy) < p.radius + player.hitboxRadius * 0.5) {
        TetrisGrid.hitShip(p.x, p.y, p.damage, player); p.active = false;
      }
    }

    // ── XP Gem 흡수
    for (const g of gems) {
      if (!g.active) continue;
      const { dx, dy } = Collision.wrappedDelta(g.x, g.y, player.x, player.y, worldW, worldH);
      const dist = Math.hypot(dx, dy);
      if (dist < g.collectRadius) {
        if (dist > 6) {
          g.x += (dx/dist)*g.speed*dt; g.y += (dy/dist)*g.speed*dt;
          g.x=((g.x%worldW)+worldW)%worldW; g.y=((g.y%worldH)+worldH)%worldH;
        } else {
          g.active = false; if (player.gainXp(g.value)) didLevelUp = true;
        }
      }
    }

    // ── ModuleDrop 수집
    for (const d of moduleDrops) {
      if (!d.active) continue;
      d.lifetime -= dt; if (d.lifetime <= 0) { d.active=false; continue; }
      const { dx:ddx, dy:ddy } = Collision.wrappedDelta(d.x, d.y, player.x, player.y, worldW, worldH);
      const collectR = Math.max(MODULE_DROP_COLLECT_RADIUS, player.hitboxRadius + 10);
      if (Math.hypot(ddx, ddy) < collectR) { d.active=false; TetrisGrid.queueModule(d.moduleType); }
    }

    return { levelUp: didLevelUp };
  }

  function damageEnemy(enemy, dmg) {
    enemy.hp -= dmg;
    if (enemy.hp <= 0) {
      enemy.active = false;
      totalKills++; waveKills++;
      const gem = acquireGem();
      if (gem) { gem.active=true; gem.x=enemy.x; gem.y=enemy.y; gem.value=enemy.xpValue; }

      if (enemy.isBoss) {
        // 보스 처치: 모듈 3개 보장 드랍 + 스크랩 다량
        bossEnemy = null;
        for (let i = 0; i < 3; i++) {
          const drop = acquireModuleDrop();
          if (drop) {
            drop.active=true;
            drop.x=enemy.x + (Math.random()-0.5)*120; drop.y=enemy.y + (Math.random()-0.5)*120;
            drop.moduleType=TetrisGrid.randomModuleKey(); drop.lifetime=MODULE_DROP_LIFETIME;
          }
        }
        if (_player) _player.scrap += 10 + Math.floor(Math.random() * 6); // 10~15 스크랩
      } else {
        // 일반 적: 15% 확률 모듈 드랍 + 소량 스크랩
        if (Math.random() < MODULE_DROP_CHANCE) {
          const drop = acquireModuleDrop();
          if (drop) {
            drop.active=true; drop.x=enemy.x; drop.y=enemy.y;
            drop.moduleType=TetrisGrid.randomModuleKey(); drop.lifetime=MODULE_DROP_LIFETIME;
          }
        }
        if (_player) _player.scrap += Math.random() < 0.5 ? 1 : 0; // 0~1 스크랩
        // 분열 처리
        if (enemy.type === 'SPLITTER' && !enemy.isSplit) { for (let i=0;i<3;i++) _spawnAt(enemy.x, enemy.y, 'SWARM'); }
        if (enemy.type === 'SENTINEL' && !enemy.isSplit) { for (let i=0;i<2;i++) _spawnAt(enemy.x, enemy.y, 'GRUNT'); }
        if (enemy.type === 'TITAN'    && !enemy.isSplit) { for (let i=0;i<2;i++) _spawnAt(enemy.x, enemy.y, 'BRUTE'); }
      }
      return true;
    }
    return false;
  }

  function draw(player) {
    const W = Renderer.getWidth(), H = Renderer.getHeight();
    const cullX = Math.ceil(W / _zoom / 2);
    const cullY = Math.ceil(H / _zoom / 2);
    const ctx   = Renderer.getCtx();

    // ── 배경 잔해물
    for (const d of debris) {
      const { sx, sy } = player.worldToScreen(d.x, d.y, worldW, worldH);
      if (sx < -cullX || sx > W+cullX || sy < -cullY || sy > H+cullY) continue;
      ctx.save();
      ctx.globalAlpha = d.alpha; ctx.fillStyle = '#7090a8';
      ctx.translate(sx, sy); ctx.rotate(d.angle);
      const s = d.size; ctx.beginPath();
      if (d.shape === 0)      { ctx.arc(0,0,s*0.5,0,Math.PI*2); }
      else if (d.shape === 1) { ctx.rect(-s*0.4,-s*0.4,s*0.8,s*0.8); }
      else if (d.shape === 2) { ctx.moveTo(0,-s*0.6); ctx.lineTo(s*0.52,s*0.42); ctx.lineTo(-s*0.52,s*0.42); }
      else                    { ctx.moveTo(0,-s*0.6); ctx.lineTo(s*0.5,0); ctx.lineTo(0,s*0.6); ctx.lineTo(-s*0.5,0); }
      ctx.closePath(); ctx.fill(); ctx.restore();
    }

    // ── 보스 투사체 (적보다 먼저 — 레이어 순서)
    for (const p of bossProjs) {
      if (!p.active) continue;
      const { sx, sy } = player.worldToScreen(p.x, p.y, worldW, worldH);
      if (sx < -cullX || sx > W+cullX || sy < -cullY || sy > H+cullY) continue;
      Renderer.drawBossProjectile(sx, sy, p.radius, p.color);
    }

    // ── 적
    for (const e of enemies) {
      if (!e.active) continue;
      const { sx, sy } = player.worldToScreen(e.x, e.y, worldW, worldH);
      if (sx < -cullX || sx > W+cullX || sy < -cullY || sy > H+cullY) continue;
      Renderer.drawEnemy(sx, sy, e.angle, e.radius, e.hp/e.maxHp, e.type, e.shadeAlpha);
      // 보스 체력 링 표시 (보스 머리 위에 HP링)
      if (e.isBoss) {
        const hpRatio = e.hp / e.maxHp;
        ctx.save();
        ctx.beginPath();
        ctx.arc(sx, sy, e.radius + 8, -Math.PI/2, -Math.PI/2 + Math.PI*2*hpRatio);
        ctx.strokeStyle = hpRatio > 0.5 ? '#ef4444' : hpRatio > 0.25 ? '#f97316' : '#fbbf24';
        ctx.lineWidth   = 4;
        ctx.stroke();
        ctx.restore();
      }
    }

    // ── XP 젬
    for (const g of gems) {
      if (!g.active) continue;
      const { sx, sy } = player.worldToScreen(g.x, g.y, worldW, worldH);
      if (sx < -cullX || sx > W+cullX || sy < -cullY || sy > H+cullY) continue;
      Renderer.drawXpGem(sx, sy);
    }

    // ── 모듈 드랍
    for (const d of moduleDrops) {
      if (!d.active) continue;
      const { sx, sy } = player.worldToScreen(d.x, d.y, worldW, worldH);
      if (sx < -cullX || sx > W+cullX || sy < -cullY || sy > H+cullY) continue;
      Renderer.drawModuleDrop(sx, sy, d.moduleType);
    }
  }

  function getActiveEnemies() { return enemies.filter(e => e.active); }
  function getBoss()  { return bossEnemy && bossEnemy.active ? bossEnemy : null; }
  function getStats() { return { waveNumber, totalKills, waveKills, waveKillTarget, restTimer, isResting }; }

  function reset(ww, wh) {
    worldW = ww; worldH = wh;
    for (const e of enemies)     e.active=false;
    for (const g of gems)        g.active=false;
    for (const d of moduleDrops) d.active=false;
    for (const p of bossProjs)   p.active=false;
    _initDebris();
    waveNumber=1; totalKills=0; waveKills=0; waveKillTarget=KILL_BASE;
    isResting=false; restTimer=0;
    spawnPending=KILL_BASE; spawnTimer=0; spawnSide=0; spawnGroupCount=0; spawnGroupTimer=0;
    bossEnemy=null;
  }

  return { init, update, draw, damageEnemy, getActiveEnemies, getStats, reset, setZoom, getBoss };
})();

window.EnemyManager = EnemyManager;
