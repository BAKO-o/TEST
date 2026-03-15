/**
 * TetrisGrid.js — 테트리스형 함선 모듈 조립 시스템
 *
 * Phase 3: 레벨업 시 BUILDING 상태로 전환하여 캔버스 기반 조립 UI를 표시.
 * 플레이어는 코어 주변 유효 슬롯을 클릭하여 모듈을 부착한다.
 * 모듈 부착 후 player.hitboxRadius가 동적으로 재계산된다.
 */

const TetrisGrid = (() => {

  // ── 상수
  const CELL  = 22;   // 셀 크기 (px) — 게임플레이 & 조립 UI 공통
  const MAX_R = 7;    // 그리드 반경 (코어 기준 ±7 칸)
  const HALF  = CELL / 2;

  // ── 그리드 상태: Map<"gx,gy", moduleType string>
  const grid = new Map();

  // ── 함체 슬롯 관리
  let maxHullSlots = 12;   // 초기 최대 함체 슬롯 (스크랩으로 증설 가능)
  const HULL_SLOT_EXPAND_COST  = 150; // 슬롯 증설 스크랩 비용
  const HULL_SLOT_EXPAND_AMOUNT = 3;  // 1회 증설 슬롯 수

  // ── 배치된 모듈 추적 (교체 기능용)
  // [{type, anchorGx, anchorGy, cells:[{gx,gy}]}]
  const placedModules = [];

  // ── 현재 배치 대기 중인 모듈
  let pending     = null;  // { type, name, cells, color, desc, bonus }
  let validSlots  = [];    // 배치 가능한 앵커 위치 [{gx,gy}]
  let moduleQueue = [];    // 드랍된 모듈 대기 큐 (타입 문자열 배열)

  // ── 드래그 & 드롭 상태
  let _isDragging         = false;
  let _dragOriginAnchorGx = 0;
  let _dragOriginAnchorGy = 0;
  let _dragPendingBackup  = null; // 드래그 시작 전 pending 백업
  let _dragPreservedHp    = 0;
  let _dragPreservedMaxHp = 0;

  // ── 티어 시스템
  const TIER_WEIGHTS = { COMMON: 72, RARE: 20, EPIC: 6, LEGENDARY: 2 };
  const TIER_LABELS  = { COMMON: '일반', RARE: '희귀', EPIC: '에픽', LEGENDARY: '전설' };
  const TIER_COLORS  = { COMMON: '#94a3b8', RARE: '#3b82f6', EPIC: '#a855f7', LEGENDARY: '#f59e0b' };

  // ── 모듈 정의 (tier: COMMON/RARE/EPIC/LEGENDARY)
  // cells: 앵커(0,0) 기준 차지하는 셀 오프셋 배열
  const MODULE_DEFS = {
    // ─── 일반 (COMMON) ───
    HULL_1:          { tier:'COMMON',    name:'장갑판 I',        cells:[{gx:0,gy:0}],                                          color:'#64748b', desc:'HP +25',                        bonus:{hp:25} },
    HULL_2:          { tier:'COMMON',    name:'장갑판 II',       cells:[{gx:0,gy:0},{gx:1,gy:0}],                              color:'#475569', desc:'HP +50',                        bonus:{hp:50} },
    THRUSTER:        { tier:'COMMON',    name:'추진기',          cells:[{gx:0,gy:0},{gx:-1,gy:0}],                             color:'#1e40af', desc:'이동속도 +15%',                  bonus:{speed:0.15} },
    WING_L:          { tier:'COMMON',    name:'좌익 모듈',       cells:[{gx:0,gy:0},{gx:0,gy:-1}],                             color:'#0e7490', desc:'HP +20 / 속도 +8%',             bonus:{hp:20,speed:0.08} },
    WING_R:          { tier:'COMMON',    name:'우익 모듈',       cells:[{gx:0,gy:0},{gx:0,gy:1}],                              color:'#0e7490', desc:'HP +20 / 속도 +8%',             bonus:{hp:20,speed:0.08} },

    // ─── 희귀 (RARE) ───
    GUN_1:           { tier:'RARE',      name:'포탑 마운트',     cells:[{gx:0,gy:0}],                                          color:'#b45309', desc:'데미지 +15%',                   bonus:{damage:0.15} },
    GUN_2:           { tier:'RARE',      name:'이중 포탑',       cells:[{gx:0,gy:0},{gx:0,gy:1}],                              color:'#92400e', desc:'데미지 +25% / 쿨다운 -15%',     bonus:{damage:0.25,cooldownMult:0.85} },
    HULL_3:          { tier:'RARE',      name:'중장갑판',        cells:[{gx:0,gy:0},{gx:1,gy:0},{gx:2,gy:0}],                 color:'#334155', desc:'HP +90',                        bonus:{hp:90} },
    THRUSTER_2:      { tier:'RARE',      name:'고출력 추진기',   cells:[{gx:0,gy:0},{gx:0,gy:1}],                              color:'#1d4ed8', desc:'이동속도 +25%',                  bonus:{speed:0.25} },
    WING_HEAVY:      { tier:'RARE',      name:'강화익',          cells:[{gx:0,gy:0},{gx:1,gy:0},{gx:0,gy:-1}],                color:'#0c4a6e', desc:'HP +40 / 속도 +12%',            bonus:{hp:40,speed:0.12} },

    // ─── 에픽 (EPIC) ───
    REACTOR:         { tier:'EPIC',      name:'반응로',          cells:[{gx:0,gy:0},{gx:1,gy:0}],                              color:'#7e22ce', desc:'데미지 +30% / 쿨다운 -15%',     bonus:{damage:0.30,cooldownMult:0.85} },
    SHIELD_CELL:     { tier:'EPIC',      name:'실드 셀',         cells:[{gx:0,gy:0}],                                          color:'#6d28d9', desc:'HP +60',                        bonus:{hp:60} },
    REINFORCED_HULL: { tier:'EPIC',      name:'강화 외장',       cells:[{gx:0,gy:0},{gx:1,gy:0},{gx:0,gy:1},{gx:1,gy:1}],    color:'#1e293b', desc:'HP +150',                       bonus:{hp:150} },
    TWIN_GUN:        { tier:'EPIC',      name:'트윈 포대',       cells:[{gx:0,gy:0},{gx:1,gy:0},{gx:-1,gy:0}],                color:'#78350f', desc:'데미지 +40% / 쿨다운 -20%',     bonus:{damage:0.40,cooldownMult:0.80} },

    // ─── 전설 (LEGENDARY) ───
    OVERCLOCK:       { tier:'LEGENDARY', name:'오버클럭 엔진',   cells:[{gx:0,gy:0},{gx:1,gy:0}],                              color:'#a16207', desc:'속도 +35% / 데미지 +20%',       bonus:{speed:0.35,damage:0.20} },
    FURY_CORE:       { tier:'LEGENDARY', name:'분노 코어',       cells:[{gx:0,gy:0}],                                          color:'#7f1d1d', desc:'데미지 +50% / 쿨다운 -25%',     bonus:{damage:0.50,cooldownMult:0.75} },
    TITAN_HULL:      { tier:'LEGENDARY', name:'타이탄 장갑',     cells:[{gx:0,gy:0},{gx:0,gy:1},{gx:0,gy:-1},{gx:0,gy:2}],   color:'#0f172a', desc:'HP +300',                       bonus:{hp:300} },

    // ─── 무기 (COMMON) ───
    WPN_GATLING:     { tier:'COMMON',    name:'개틀링포',        cells:[{gx:0,gy:0}],                                          color:'#dc2626', desc:'빠른 3방향 연사',               bonus:{weapon:'WPN_GATLING'} },
    WPN_FLAK:        { tier:'COMMON',    name:'플랙포',          cells:[{gx:0,gy:0}],                                          color:'#ca8a04', desc:'8방향 근거리 폭발',              bonus:{weapon:'WPN_FLAK'} },
    WPN_LASER:       { tier:'COMMON',    name:'레이저포',        cells:[{gx:0,gy:0}],                                          color:'#2563eb', desc:'초고속 단일 연사',               bonus:{weapon:'WPN_LASER'} },

    // ─── 무기 (RARE) ───
    WPN_SPREAD:      { tier:'RARE',      name:'산탄포',          cells:[{gx:0,gy:0},{gx:1,gy:0}],                              color:'#ea580c', desc:'5발 부채꼴 발사',               bonus:{weapon:'WPN_SPREAD'} },
    WPN_MISSILE:     { tier:'RARE',      name:'유도탄',          cells:[{gx:0,gy:0},{gx:1,gy:0}],                              color:'#0891b2', desc:'호밍 미사일 발사',               bonus:{weapon:'WPN_MISSILE'} },
    WPN_ORBIT:       { tier:'RARE',      name:'궤도포',          cells:[{gx:0,gy:0},{gx:0,gy:1}],                              color:'#059669', desc:'3개 공전 탄',                   bonus:{weapon:'WPN_ORBIT'} },
    WPN_MINE:        { tier:'RARE',      name:'기뢰',            cells:[{gx:0,gy:0},{gx:1,gy:0}],                              color:'#7f1d1d', desc:'정지 기뢰 설치',                bonus:{weapon:'WPN_MINE'} },

    // ─── 무기 (EPIC) ───
    WPN_SNIPER:      { tier:'EPIC',      name:'저격포',          cells:[{gx:0,gy:0},{gx:0,gy:1}],                              color:'#7c3aed', desc:'고데미지 단발 저격',            bonus:{weapon:'WPN_SNIPER'} },
    WPN_CHAIN:       { tier:'EPIC',      name:'연쇄탄',          cells:[{gx:0,gy:0}],                                          color:'#9d174d', desc:'연쇄 충격파 3회',              bonus:{weapon:'WPN_CHAIN'} },
    WPN_NOVA:        { tier:'EPIC',      name:'노바포',          cells:[{gx:0,gy:0},{gx:0,gy:1}],                              color:'#6d28d9', desc:'전방향 12발 폭발',              bonus:{weapon:'WPN_NOVA'} },
    WPN_PLASMA:      { tier:'EPIC',      name:'플라즈마포',      cells:[{gx:0,gy:0},{gx:1,gy:0}],                              color:'#c026d3', desc:'7발 광역 플라즈마',             bonus:{weapon:'WPN_PLASMA'} },
    WPN_RAILGUN:     { tier:'EPIC',      name:'레일건',          cells:[{gx:0,gy:0},{gx:0,gy:1},{gx:0,gy:2}],                 color:'#0369a1', desc:'초고데미지 관통탄',             bonus:{weapon:'WPN_RAILGUN'} },

    // ─── 무기 (LEGENDARY) ───
    WPN_TYPHOON:     { tier:'LEGENDARY', name:'태풍포',          cells:[{gx:0,gy:0},{gx:1,gy:0},{gx:0,gy:1}],                 color:'#0c4a6e', desc:'8방향 고속 연사',               bonus:{weapon:'WPN_TYPHOON'} },
    WPN_ANNIHILATOR: { tier:'LEGENDARY', name:'소멸자',          cells:[{gx:0,gy:0},{gx:1,gy:0},{gx:2,gy:0}],                 color:'#450a0a', desc:'5연쇄 고데미지 충격파',         bonus:{weapon:'WPN_ANNIHILATOR'} },
    WPN_OMEGA:       { tier:'LEGENDARY', name:'오메가포',        cells:[{gx:0,gy:0},{gx:0,gy:1},{gx:1,gy:0},{gx:1,gy:1}],    color:'#312e81', desc:'24발 전방향 포격',             bonus:{weapon:'WPN_OMEGA'} },
  };

  const MODULE_KEYS = Object.keys(MODULE_DEFS);

  // ────────────────── 초기화 ──────────────────

  /** 그리드 초기화 — 코어(0,0) 배치 */
  function init() {
    grid.clear();
    grid.set('0,0', 'CORE');
    pending     = null;
    validSlots  = [];
    moduleQueue = [];
    maxHullSlots = 12;
    placedModules.length = 0;
    _isDragging = false;
    _dragPendingBackup = null;
  }

  // ────────────────── 슬롯 계산 ──────────────────

  /**
   * 유효 앵커 슬롯 계산
   * 조건: 빈 칸 + 기존 점유 셀에 상하좌우 인접 + 범위 내
   */
  function _calcValidSlots() {
    const slots = new Map(); // "gx,gy" → {gx,gy}
    const dirs  = [{gx:1,gy:0},{gx:-1,gy:0},{gx:0,gy:1},{gx:0,gy:-1}];

    for (const [key] of grid) {
      const [ox, oy] = key.split(',').map(Number);
      for (const d of dirs) {
        const nx = ox + d.gx, ny = oy + d.gy;
        const nk = `${nx},${ny}`;
        if (!grid.has(nk) && Math.abs(nx) <= MAX_R && Math.abs(ny) <= MAX_R) {
          if (!slots.has(nk)) slots.set(nk, {gx: nx, gy: ny});
        }
      }
    }
    return [...slots.values()];
  }

  // ────────────────── 배치 검증 ──────────────────

  /**
   * pending 모듈을 앵커(agx, agy)에 배치 가능한지 검증
   * @param {number} agx
   * @param {number} agy
   * @returns {boolean}
   */
  function canPlace(agx, agy) {
    if (!pending) return false;
    // 앵커가 유효 슬롯에 있어야 함
    if (!validSlots.some(s => s.gx === agx && s.gy === agy)) return false;
    // pending의 모든 셀이 비어있고 범위 내
    for (const c of pending.cells) {
      const nx = agx + c.gx, ny = agy + c.gy;
      if (grid.has(`${nx},${ny}`)) return false;
      if (Math.abs(nx) > MAX_R || Math.abs(ny) > MAX_R) return false;
    }
    // 함체 슬롯 여유 확인 (CORE 제외)
    const usedSlots = grid.size - 1;
    if (usedSlots + pending.cells.length > maxHullSlots) return false;
    return true;
  }

  // ────────────────── 배치 실행 ──────────────────

  /** 티어 가중치 기반 랜덤 모듈 키 선택 */
  function _weightedRandomKey() {
    const keys = MODULE_KEYS;
    let total = 0;
    for (const k of keys) total += TIER_WEIGHTS[MODULE_DEFS[k].tier] ?? 30;
    let r = Math.random() * total;
    for (const k of keys) {
      r -= TIER_WEIGHTS[MODULE_DEFS[k].tier] ?? 30;
      if (r <= 0) return k;
    }
    return keys[keys.length - 1];
  }

  /**
   * 랜덤 모듈을 pending으로 설정하고 유효 슬롯 계산
   * @returns {object} pending 모듈
   */
  function offerRandom() {
    const key  = _weightedRandomKey();
    const def  = MODULE_DEFS[key];
    // 셀 배열 복사 (원본 불변)
    pending = { type: key, ...def, cells: def.cells.map(c => ({...c})) };
    validSlots = _calcValidSlots();
    return pending;
  }

  /**
   * pending 모듈을 90° 시계방향으로 회전 (스크린 좌표계: (gx,gy)→(-gy,gx))
   * R키를 누를 때 Game.js에서 호출
   */
  function rotatePending() {
    if (!pending) return;
    pending.cells = pending.cells.map(c => ({ gx: -c.gy, gy: c.gx }));
    validSlots = _calcValidSlots();
  }

  /**
   * 랜덤 모듈 타입 키 반환 (EnemyManager 드랍 시 호출) — 티어 가중치 적용
   */
  function randomModuleKey() {
    return _weightedRandomKey();
  }

  /**
   * 특정 모듈 타입을 큐에 추가 (ModuleDrop 수집 시 호출)
   */
  function queueModule(typeKey) {
    if (MODULE_DEFS[typeKey]) moduleQueue.push(typeKey);
  }

  /**
   * 랜덤 모듈 타입을 큐에 추가 (하위 호환)
   */
  function queueRandomModule() {
    moduleQueue.push(randomModuleKey());
  }

  /**
   * 큐에서 다음 모듈을 꺼내 pending으로 설정 (Q키 누를 때 Game.js에서 호출)
   * @returns {boolean} 성공 여부
   */
  function nextModule() {
    if (moduleQueue.length === 0) return false;
    const key = moduleQueue.shift();
    const def = MODULE_DEFS[key];
    pending = { type: key, ...def, cells: def.cells.map(c => ({...c})) };
    validSlots = _calcValidSlots();
    return true;
  }

  /** 큐 또는 pending에 모듈이 있으면 true */
  function hasQueued() {
    return moduleQueue.length > 0 || pending !== null;
  }

  /** HUD 뱃지용: 총 대기 모듈 수 */
  function getQueueSize() {
    return moduleQueue.length + (pending ? 1 : 0);
  }

  /**
   * pending 모듈을 앵커(agx, agy)에 배치
   * @param {number} agx
   * @param {number} agy
   * @param {object} player - Player 인스턴스
   * @returns {boolean} 성공 여부
   */
  function place(agx, agy, player) {
    if (!canPlace(agx, agy)) return false;

    const placedCells = [];
    for (const c of pending.cells) {
      const cellGx = agx + c.gx, cellGy = agy + c.gy;
      grid.set(`${cellGx},${cellGy}`, pending.type);
      placedCells.push({ gx: cellGx, gy: cellGy });
    }

    // 배치 이력 저장 (모듈 HP 포함)
    const def = MODULE_DEFS[pending.type];
    const hullHp = def?.bonus?.hp ?? 0; // 장갑판 계열만 내구도 보유
    placedModules.push({
      type: pending.type, anchorGx: agx, anchorGy: agy, cells: placedCells,
      hp: hullHp,       // 현재 내구도 (0 = 비장갑 모듈)
      maxHp: hullHp,    // 최대 내구도
    });

    _applyBonus(pending.bonus, player);
    recalcHitbox(player);

    pending    = null;
    validSlots = [];
    return true;
  }

  /**
   * 그리드 상의 (gx, gy) 셀을 포함하는 모듈을 제거한다 (교체 모드용)
   * 보너스는 되돌리지 않음 (설계상 유지)
   * @returns {boolean} 제거 성공 여부
   */
  function removeModuleAt(gx, gy) {
    const key = `${gx},${gy}`;
    if (!grid.has(key) || grid.get(key) === 'CORE') return false;
    const idx = placedModules.findIndex(m => m.cells.some(c => c.gx === gx && c.gy === gy));
    if (idx < 0) return false;
    const mod = placedModules[idx];
    for (const c of mod.cells) grid.delete(`${c.gx},${c.gy}`);
    placedModules.splice(idx, 1);
    return true;
  }

  // ────────────────── 드래그 & 드롭 시스템 ──────────────────

  /**
   * (gx, gy) 셀의 모듈을 들어 올려 드래그 시작.
   * 모듈을 그리드에서 제거하고 pending에 임시 설정한다.
   * @returns {boolean} 드래그 시작 성공 여부
   */
  function tryStartDrag(gx, gy, player) {
    const key = `${gx},${gy}`;
    if (!grid.has(key) || grid.get(key) === 'CORE') return false;

    const idx = placedModules.findIndex(m => m.cells.some(c => c.gx === gx && c.gy === gy));
    if (idx < 0) return false;

    const mod = placedModules[idx];
    const def = MODULE_DEFS[mod.type];
    if (!def) return false;

    // pending 및 드래그 원점 백업
    _dragPendingBackup  = pending;
    _dragOriginAnchorGx = mod.anchorGx;
    _dragOriginAnchorGy = mod.anchorGy;
    _dragPreservedHp    = mod.hp;
    _dragPreservedMaxHp = mod.maxHp;

    // 그리드·placedModules 에서 제거
    for (const c of mod.cells) grid.delete(`${c.gx},${c.gy}`);
    placedModules.splice(idx, 1);

    // 절대 좌표 → 앵커 기준 상대 좌표로 복원
    const relativeCells = mod.cells.map(c => ({
      gx: c.gx - mod.anchorGx,
      gy: c.gy - mod.anchorGy,
    }));
    pending = {
      type: mod.type, name: def.name, cells: relativeCells,
      color: def.color, desc: def.desc, bonus: def.bonus, tier: def.tier,
    };

    validSlots  = _calcValidSlots();
    recalcHitbox(player);
    _isDragging = true;
    return true;
  }

  /**
   * 보너스 재적용 없이 지정 앵커에 pending 모듈을 배치한다 (드래그 전용).
   * HP/MaxHp는 보존값을 사용한다.
   */
  function _placePreserved(agx, agy) {
    const placedCells = [];
    for (const c of pending.cells) {
      const cx2 = agx + c.gx, cy2 = agy + c.gy;
      grid.set(`${cx2},${cy2}`, pending.type);
      placedCells.push({ gx: cx2, gy: cy2 });
    }
    placedModules.push({
      type: pending.type, anchorGx: agx, anchorGy: agy,
      cells: placedCells,
      hp: _dragPreservedHp, maxHp: _dragPreservedMaxHp,
    });
  }

  /**
   * 드래그 종료: 현재 마우스 위치가 유효하면 새 위치에, 아니면 원위치에 드롭.
   * @param {number} sx  - 마우스 화면 X
   * @param {number} sy  - 마우스 화면 Y
   * @param {number} cx  - 화면 중앙 X
   * @param {number} cy  - 화면 중앙 Y
   * @param {object} player
   */
  function endDrag(sx, sy, cx, cy, player) {
    if (!_isDragging) return;
    _isDragging = false;

    const tgx = Math.round((sx - cx) / CELL);
    const tgy = Math.round((sy - cy) / CELL);

    if (canPlace(tgx, tgy)) {
      _placePreserved(tgx, tgy);
    } else {
      // 원위치 복구 — canPlace 없이 직접 삽입 (원래 있던 자리이므로 항상 유효)
      _placePreserved(_dragOriginAnchorGx, _dragOriginAnchorGy);
    }

    // 원래 pending 복원
    pending    = _dragPendingBackup;
    _dragPendingBackup = null;
    validSlots = _calcValidSlots();
    recalcHitbox(player);
  }

  /** 드래그 중 여부 반환 */
  function isDragging() { return _isDragging; }

  /**
   * 함체 슬롯 증설 (스크랩 소모 후 Game.js에서 호출)
   */
  function expandHullSlots(amount) {
    maxHullSlots += amount;
  }

  /** 현재 사용 중인 슬롯 수 (CORE 제외) */
  function getUsedSlots() { return grid.size - 1; }

  /** 최대 슬롯 수 */
  function getMaxSlots() { return maxHullSlots; }

  /** 슬롯 증설 비용 */
  function getExpandCost() { return HULL_SLOT_EXPAND_COST; }

  /** 슬롯 증설 시 증가량 */
  function getExpandAmount() { return HULL_SLOT_EXPAND_AMOUNT; }

  /** 보너스 적용 (hp는 코어HP에 영향 없음 — 모듈 자체 내구도로 처리) */
  function _applyBonus(bonus, player) {
    // bonus.hp: 장갑판 내구도로 사용; 플레이어 HP에는 가산하지 않음
    if (bonus.speed)        player.speedMult  += bonus.speed;
    if (bonus.damage)       player.damageMult += bonus.damage;
    if (bonus.cooldownMult) {
      const cur = WeaponSystem.getWeaponStat('cooldown') ?? 0.72;
      WeaponSystem.upgradeWeapon('cooldown', Math.max(0.15, cur * bonus.cooldownMult));
    }
    if (bonus.weapon) WeaponSystem.addSecondary(bonus.weapon);
  }

  /**
   * 부착된 모든 모듈 셀의 최대 코너 거리로 player.hitboxRadius 재계산
   */
  function recalcHitbox(player) {
    let maxDist = player.radius;
    for (const [key] of grid) {
      if (key === '0,0') continue;
      const [gx, gy] = key.split(',').map(Number);
      // 셀의 4 코너 거리 계산
      const corners = [
        {x: (gx - 0.5) * CELL, y: (gy - 0.5) * CELL},
        {x: (gx + 0.5) * CELL, y: (gy - 0.5) * CELL},
        {x: (gx - 0.5) * CELL, y: (gy + 0.5) * CELL},
        {x: (gx + 0.5) * CELL, y: (gy + 0.5) * CELL},
      ];
      for (const corner of corners) {
        maxDist = Math.max(maxDist, Math.hypot(corner.x, corner.y));
      }
    }
    player.hitboxRadius = maxDist;
  }

  // ────────────────── 피격·모듈 파괴 시스템 ──────────────────

  /**
   * 인덱스로 모듈을 즉시 파괴한다 (그리드 제거 + hitbox 재계산)
   * @param {number} idx - placedModules 배열 인덱스
   * @param {object} player
   */
  function _destroyModule(idx, player) {
    const mod = placedModules[idx];
    if (!mod) return;
    for (const c of mod.cells) grid.delete(`${c.gx},${c.gy}`);
    placedModules.splice(idx, 1);
    recalcHitbox(player);
    // 파괴 시각 효과: 마지막 파괴 정보 기록 (drawShipModules에서 플래시)
    lastDestroyedCell = mod.cells[0] ?? null;
    lastDestroyFlash  = 0.35; // 0.35초 플래시
  }

  /**
   * 공격 위치로부터 피격 모듈을 결정하고 처리한다.
   *  - 장갑판 계열(hp > 0): 내구도 감소 → 0 이하면 파괴
   *  - 비장갑 모듈(hp === 0): 즉시 파괴
   *  - 모듈 없음: 코어 직격 → player.takeDamage()
   * @param {number} impactX - 공격자 월드 X
   * @param {number} impactY - 공격자 월드 Y
   * @param {number} dmg     - 피해량
   * @param {object} player
   */
  function hitShip(impactX, impactY, dmg, player) {
    if (!player || player.invincibleTime > 0) return;
    if (placedModules.length === 0) { player.takeDamage(dmg); return; }

    // 공격 방향 → 플레이어 로컬 좌표계로 변환
    const dex = impactX - player.x, dey = impactY - player.y;
    const d   = Math.hypot(dex, dey) || 1;
    const nx  = dex / d, ny = dey / d;

    // 플레이어 회전각의 역방향 변환 (그리드는 로컬 좌표)
    const cos = Math.cos(-player.angle), sin = Math.sin(-player.angle);
    const ldx = cos * nx - sin * ny;
    const ldy = sin * nx + cos * ny;

    // 공격 방향으로 가장 노출된 모듈 탐색
    let bestScore = -Infinity, bestIdx = -1;
    for (let i = 0; i < placedModules.length; i++) {
      for (const c of placedModules[i].cells) {
        const score = c.gx * ldx + c.gy * ldy;
        if (score > bestScore) { bestScore = score; bestIdx = i; }
      }
    }

    if (bestIdx < 0) { player.takeDamage(dmg); return; }

    const mod = placedModules[bestIdx];
    if (mod.hp > 0) {
      // 장갑판: 내구도 소모
      mod.hp -= dmg;
      if (mod.hp <= 0) _destroyModule(bestIdx, player);
      else { lastDestroyedCell = mod.cells[0]; lastDestroyFlash = 0.18; } // 피격 플래시
    } else {
      // 비장갑 모듈: 즉시 파괴
      _destroyModule(bestIdx, player);
    }
  }

  // ── 파괴 플래시 상태 (drawShipModules에서 소비)
  let lastDestroyedCell = null;
  let lastDestroyFlash  = 0; // 남은 플래시 시간(s)

  /** 파괴 플래시 타이머 업데이트 (Game.js update()에서 dt 전달) */
  function updateFlash(dt) { if (lastDestroyFlash > 0) lastDestroyFlash -= dt; }

  // ────────────────── 조립 UI 클릭 처리 ──────────────────

  /**
   * 조립 화면에서 클릭 위치로 배치 시도
   * @param {number} sx - 화면 클릭 X
   * @param {number} sy - 화면 클릭 Y
   * @param {number} cx - 화면 중앙 X (그리드 원점)
   * @param {number} cy - 화면 중앙 Y
   * @param {object} player
   * @returns {boolean} 배치 성공 여부
   */
  function handleClick(sx, sy, cx, cy, player) {
    const gx = Math.round((sx - cx) / CELL);
    const gy = Math.round((sy - cy) / CELL);

    // 정상 배치 시도
    if (canPlace(gx, gy)) return place(gx, gy, player);

    // 슬롯이 꽉 찼을 때: 기존 모듈 클릭 시 제거 (교체 1단계)
    const usedSlots = grid.size - 1;
    if (usedSlots >= maxHullSlots) {
      const removed = removeModuleAt(gx, gy);
      if (removed) {
        validSlots = _calcValidSlots(); // 슬롯 재계산
        recalcHitbox(player);
      }
    }
    return false; // 조립창 유지
  }

  // ────────────────── 렌더링 ──────────────────

  /**
   * 게임플레이 중 함선 위에 모듈을 그린다 (함선 회전 적용)
   * Player.draw()에서 Renderer.drawPlayer() 호출 전에 실행
   */
  function drawShipModules(ctx, cx, cy, angle) {
    if (grid.size <= 1) return; // 코어만 있으면 스킵

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    // 피격 플래시 셀 캐싱
    const flashCell = lastDestroyFlash > 0 && lastDestroyedCell
      ? `${lastDestroyedCell.gx},${lastDestroyedCell.gy}` : null;

    for (const [key, type] of grid) {
      if (type === 'CORE') continue;
      const [gx, gy] = key.split(',').map(Number);
      const def = MODULE_DEFS[type];
      const color = def ? def.color : '#334455';

      // 피격 플래시
      const isFlash = flashCell && (key === flashCell || placedModules.some(m => m.cells.some(c=>`${c.gx},${c.gy}`===flashCell && m.cells.some(c2=>`${c2.gx},${c2.gy}`===key))));
      ctx.fillStyle = isFlash ? `rgba(255,80,80,${Math.min(1, lastDestroyFlash * 4)})` : color;
      ctx.fillRect(gx * CELL - HALF, gy * CELL - HALF, CELL, CELL);
      ctx.strokeStyle = 'rgba(150,200,255,0.35)';
      ctx.lineWidth   = 1;
      ctx.strokeRect(gx * CELL - HALF, gy * CELL - HALF, CELL, CELL);

      // 장갑판 HP 바 (게임플레이 중 각 셀 하단에 표시)
      const mod = placedModules.find(m => m.cells.some(c => c.gx === gx && c.gy === gy));
      if (mod && mod.maxHp > 0) {
        const ratio = Math.max(0, mod.hp / mod.maxHp);
        const bx = gx * CELL - HALF + 1, by = gy * CELL + HALF - 4;
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(bx, by, CELL - 2, 3);
        ctx.fillStyle = ratio > 0.5 ? '#4ade80' : ratio > 0.25 ? '#fbbf24' : '#ef4444';
        ctx.fillRect(bx, by, (CELL - 2) * ratio, 3);
      }
    }

    ctx.restore();
  }

  /**
   * 조립 화면 전체를 캔버스에 그린다 (STATE.BUILDING 시 render()에서 호출)
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx - 화면 중앙 X
   * @param {number} cy - 화면 중앙 Y
   * @param {number} mouseX - 마우스 화면 X
   * @param {number} mouseY - 마우스 화면 Y
   */
  function drawOnCanvas(ctx, cx, cy, mouseX, mouseY, player) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;

    // ── 1. 어두운 반투명 오버레이
    ctx.fillStyle = 'rgba(0, 2, 18, 0.85)';
    ctx.fillRect(0, 0, W, H);

    // ── 2. 헤더
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = 'bold 20px "Segoe UI", sans-serif';
    ctx.fillStyle    = '#93c5fd';
    ctx.fillText('🔧 함선 모듈 조립', cx, 36);
    ctx.font      = '12px "Segoe UI", sans-serif';

    const usedSlots = grid.size - 1;
    const isFull    = usedSlots >= maxHullSlots;
    if (isFull) {
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(`⚠ 함체 슬롯 포화 — 기존 모듈을 클릭하면 제거됩니다 (교체 후 재배치)`, cx, 62);
    } else {
      ctx.fillStyle = '#5577aa';
      ctx.fillText('유효한 슬롯(파란 테두리)을 클릭해 부착 · 기존 모듈을 클릭 드래그로 이동', cx, 62);
    }

    // ── 3. 마우스→그리드 좌표
    const hgx = Math.round((mouseX - cx) / CELL);
    const hgy = Math.round((mouseY - cy) / CELL);
    const isValidHover = pending && canPlace(hgx, hgy);

    // ── 4. 배치된 모듈 셀
    for (const [key, type] of grid) {
      const [gx, gy] = key.split(',').map(Number);
      const sx = cx + gx * CELL;
      const sy = cy + gy * CELL;

      if (type === 'CORE') {
        _drawCoreIcon(ctx, sx, sy);
      } else {
        const def   = MODULE_DEFS[type];
        const color = def ? def.color : '#334455';
        // 드래그 중이 아닐 때 hover된 모듈 강조
        const isDragHover = !_isDragging && (gx === hgx && gy === hgy);
        ctx.fillStyle = isDragHover ? (def ? def.color + 'cc' : '#334455cc') : (def ? def.color : '#334455');
        ctx.globalAlpha = isDragHover ? 1.0 : 0.9;
        ctx.fillRect(sx - HALF, sy - HALF, CELL, CELL);
        ctx.globalAlpha = 1.0;
        // 테두리: 드래그 가능 강조(hover) / 슬롯 포화 / 일반
        if (isDragHover) {
          ctx.strokeStyle = 'rgba(251,191,36,0.95)';
          ctx.lineWidth   = 2;
        } else if (isFull) {
          const pulse2 = 0.5 + 0.5 * Math.sin(Date.now() * 0.005);
          ctx.strokeStyle = `rgba(251,191,36,${0.5 + pulse2 * 0.5})`;
          ctx.lineWidth   = 1.5;
        } else {
          ctx.strokeStyle = 'rgba(200,220,255,0.5)';
          ctx.lineWidth   = 1;
        }
        ctx.strokeRect(sx - HALF, sy - HALF, CELL, CELL);
      }
    }

    // ── 4b. 드래그 중: 원위치에 점선 테두리 표시
    if (_isDragging && pending) {
      const pulse3 = 0.5 + 0.5 * Math.sin(Date.now() * 0.006);
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = `rgba(251,191,36,${0.45 + pulse3 * 0.45})`;
      ctx.lineWidth   = 1.5;
      for (const c of pending.cells) {
        const ox = cx + (_dragOriginAnchorGx + c.gx) * CELL;
        const oy = cy + (_dragOriginAnchorGy + c.gy) * CELL;
        ctx.strokeRect(ox - HALF + 1, oy - HALF + 1, CELL - 2, CELL - 2);
      }
      ctx.setLineDash([]);
    }

    // ── 5. 유효 슬롯 표시
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.004);
    for (const s of validSlots) {
      const sx = cx + s.gx * CELL;
      const sy = cy + s.gy * CELL;
      const isHover = (s.gx === hgx && s.gy === hgy);
      ctx.strokeStyle = isHover
        ? `rgba(100,220,255,0.9)`
        : `rgba(56,189,248,${0.3 + pulse * 0.4})`;
      ctx.lineWidth = isHover ? 2 : 1.5;
      ctx.strokeRect(sx - HALF + 1, sy - HALF + 1, CELL - 2, CELL - 2);
    }

    // ── 6. 호버 프리뷰
    if (pending && isValidHover) {
      ctx.globalAlpha = 0.45;
      for (const c of pending.cells) {
        const psx = cx + (hgx + c.gx) * CELL;
        const psy = cy + (hgy + c.gy) * CELL;
        ctx.fillStyle = pending.color;
        ctx.fillRect(psx - HALF, psy - HALF, CELL, CELL);
      }
      ctx.globalAlpha = 1;
    }

    // ── 7. 좌측 패널: 현재 장착 모듈 목록
    _drawInstalledPanel(ctx, W, H, player);

    // ── 8. 우측 패널: 제공 모듈 카드
    if (pending) _drawModulePanel(ctx, W, H);

    // ── 9. 하단 힌트
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font      = '12px "Segoe UI", sans-serif';
    ctx.fillStyle = '#334466';
    const scrap = player ? player.scrap : 0;
    ctx.fillText(
      `[R] 회전   [Space] 건너뛰기   [E] 슬롯 증설 (+${HULL_SLOT_EXPAND_AMOUNT}슬롯, 비용: ${HULL_SLOT_EXPAND_COST} Scrap)  ─  보유 Scrap: ${scrap}`,
      cx, H - 28
    );
  }

  /** 좌측 패널: 현재 장착된 모듈 목록 */
  function _drawInstalledPanel(ctx, W, H, player) {
    const PAD  = 14;
    const PW   = 190;
    const PH   = Math.min(H - 120, 420);
    const px   = 16;
    const py   = (H - PH) / 2;
    const rad  = 10;
    const usedSlots = grid.size - 1;

    // 카드 배경
    ctx.fillStyle = 'rgba(8, 15, 40, 0.92)';
    _roundRect(ctx, px, py, PW, PH, rad);
    ctx.fill();
    ctx.strokeStyle = 'rgba(99,179,237,0.3)';
    ctx.lineWidth   = 1;
    _roundRect(ctx, px, py, PW, PH, rad);
    ctx.stroke();

    // 헤더
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.font         = 'bold 13px "Segoe UI", sans-serif';
    ctx.fillStyle    = '#7dd3fc';
    ctx.fillText('장착 모듈', px + PAD, py + PAD + 4);

    // 슬롯 사용량
    const slotText = `${usedSlots} / ${maxHullSlots} 슬롯`;
    const slotColor = usedSlots >= maxHullSlots ? '#fbbf24' : '#86efac';
    ctx.font      = '11px "Segoe UI", sans-serif';
    ctx.fillStyle = slotColor;
    ctx.textAlign = 'right';
    ctx.fillText(slotText, px + PW - PAD, py + PAD + 4);

    // 슬롯 바
    const barY  = py + PAD + 18;
    const barW  = PW - PAD * 2;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(px + PAD, barY, barW, 6);
    ctx.fillStyle = slotColor;
    ctx.fillRect(px + PAD, barY, barW * Math.min(1, usedSlots / maxHullSlots), 6);

    // 구분선
    ctx.strokeStyle = 'rgba(100,140,200,0.2)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(px + PAD, barY + 12);
    ctx.lineTo(px + PW - PAD, barY + 12);
    ctx.stroke();

    // 모듈 목록
    const listStartY = barY + 24;
    const itemH      = 36;
    const maxItems   = Math.floor((PH - (listStartY - py) - PAD * 2) / itemH);

    if (placedModules.length === 0) {
      ctx.font      = '12px "Segoe UI", sans-serif';
      ctx.fillStyle = '#475569';
      ctx.textAlign = 'center';
      ctx.fillText('장착된 모듈 없음', px + PW / 2, listStartY + 20);
    } else {
      const visModules = placedModules.slice(0, maxItems);
      for (let i = 0; i < visModules.length; i++) {
        const m   = visModules[i];
        const def = MODULE_DEFS[m.type];
        if (!def) continue;
        const iy  = listStartY + i * itemH;

        // 색상 스워치 (티어 색상 테두리)
        const tc = TIER_COLORS[def.tier] ?? '#94a3b8';
        ctx.fillStyle = def.color;
        ctx.fillRect(px + PAD, iy + 6, 12, 12);
        ctx.strokeStyle = tc;
        ctx.lineWidth   = 1;
        ctx.strokeRect(px + PAD, iy + 6, 12, 12);

        // 모듈 이름
        ctx.font      = 'bold 11px "Segoe UI", sans-serif';
        ctx.fillStyle = '#e2e8f0';
        ctx.textAlign = 'left';
        ctx.fillText(def.name, px + PAD + 18, iy + 10);

        // 설명 or HP 바 (장갑판은 HP 바로 대체)
        if (m.maxHp > 0) {
          const ratio = Math.max(0, m.hp / m.maxHp);
          const hbx = px + PAD + 18, hby = iy + 18;
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(hbx, hby, PW - PAD * 2 - 18, 5);
          ctx.fillStyle = ratio > 0.5 ? '#4ade80' : ratio > 0.25 ? '#fbbf24' : '#ef4444';
          ctx.fillRect(hbx, hby, (PW - PAD * 2 - 18) * ratio, 5);
          ctx.font = '9px "Segoe UI", sans-serif';
          ctx.fillStyle = '#94a3b8';
          ctx.textAlign = 'left';
          ctx.fillText(`내구도 ${Math.ceil(m.hp)}/${m.maxHp}`, hbx, iy + 32);
        } else {
          ctx.font      = '10px "Segoe UI", sans-serif';
          ctx.fillStyle = '#86efac';
          ctx.textAlign = 'left';
          ctx.fillText(def.desc, px + PAD + 18, iy + 24);
        }

        // 티어 뱃지
        ctx.font      = '9px "Segoe UI", sans-serif';
        ctx.fillStyle = tc;
        ctx.textAlign = 'right';
        ctx.fillText(TIER_LABELS[def.tier] ?? '일반', px + PW - PAD, iy + 10);
      }
      if (placedModules.length > maxItems) {
        ctx.font      = '10px "Segoe UI", sans-serif';
        ctx.fillStyle = '#475569';
        ctx.textAlign = 'center';
        ctx.fillText(`+${placedModules.length - maxItems}개 더...`, px + PW / 2, listStartY + maxItems * itemH + 8);
      }
    }

    // 스크랩 & 증설 정보
    const scrap = player ? player.scrap : 0;
    const footY = py + PH - PAD - 4;
    ctx.strokeStyle = 'rgba(100,140,200,0.2)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(px + PAD, footY - 24);
    ctx.lineTo(px + PW - PAD, footY - 24);
    ctx.stroke();
    ctx.font      = '11px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`🔩 Scrap: ${scrap}`, px + PAD, footY - 10);
    const canExpand = scrap >= HULL_SLOT_EXPAND_COST;
    ctx.fillStyle = canExpand ? '#86efac' : '#475569';
    ctx.fillText(`[E] +${HULL_SLOT_EXPAND_AMOUNT}슬롯 (${HULL_SLOT_EXPAND_COST} Scrap)`, px + PAD, footY + 4);
  }

  /** 코어 아이콘 (작은 파란 삼각형) */
  function _drawCoreIcon(ctx, sx, sy) {
    ctx.save();
    ctx.translate(sx, sy);
    const r = HALF * 0.75;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(-r * 0.6, -r * 0.75);
    ctx.lineTo(-r * 0.6,  r * 0.75);
    ctx.closePath();
    ctx.fillStyle   = '#2563eb';
    ctx.fill();
    ctx.strokeStyle = '#93c5fd';
    ctx.lineWidth   = 1;
    ctx.stroke();
    ctx.restore();
  }

  /** 우측 패널: 제공 모듈 정보 카드 */
  function _drawModulePanel(ctx, W, H) {
    const PAD    = 14;
    const PW     = 175;
    const PH     = 195;
    const px     = W - PW - 24;
    const py     = H / 2 - PH / 2;
    const radius = 10;
    const tier       = pending.tier ?? 'COMMON';
    const tierColor  = TIER_COLORS[tier];
    const tierLabel  = TIER_LABELS[tier];

    // 카드 배경 (티어 색상 테두리)
    ctx.fillStyle = 'rgba(10, 20, 50, 0.94)';
    _roundRect(ctx, px, py, PW, PH, radius);
    ctx.fill();
    ctx.strokeStyle = tierColor + 'aa';
    ctx.lineWidth = 1.5;
    _roundRect(ctx, px, py, PW, PH, radius);
    ctx.stroke();

    // 티어 뱃지
    ctx.font      = 'bold 10px "Segoe UI", sans-serif';
    ctx.fillStyle = tierColor;
    ctx.textAlign = 'left';
    ctx.fillText(`★ ${tierLabel}`, px + PAD, py + PAD + 2);

    // 헤더
    ctx.font      = '11px "Segoe UI", sans-serif';
    ctx.fillStyle = '#5577aa';
    ctx.fillText('제공 모듈', px + PAD, py + PAD + 16);

    // 모듈 이름
    ctx.font      = 'bold 14px "Segoe UI", sans-serif';
    ctx.fillStyle = '#e0f0ff';
    ctx.fillText(pending.name, px + PAD, py + PAD + 34);

    // 미니 형태 프리뷰 (5×5 그리드, ±2 범위)
    const mini  = 10;
    const gridW = 5 * mini;
    const offX  = px + PW / 2 - gridW / 2;
    const offY  = py + PAD + 50;
    ctx.strokeStyle = 'rgba(100,140,200,0.25)';
    ctx.lineWidth   = 0.5;
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        ctx.strokeRect(offX + (c + 2) * mini, offY + (r + 2) * mini, mini, mini);
      }
    }
    // 모듈 셀 채우기 (±2 범위 내)
    for (const c of pending.cells) {
      if (c.gx >= -2 && c.gx <= 2 && c.gy >= -2 && c.gy <= 2) {
        ctx.fillStyle = pending.color;
        ctx.fillRect(offX + (c.gx + 2) * mini, offY + (c.gy + 2) * mini, mini, mini);
      }
    }
    // 코어 표시
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(offX + 2 * mini, offY + 2 * mini, mini, mini);

    // 구분선
    const descY = offY + 5 * mini + 8;
    ctx.strokeStyle = 'rgba(100,140,200,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + PAD, descY - 4);
    ctx.lineTo(px + PW - PAD, descY - 4);
    ctx.stroke();

    // 설명 (보너스)
    ctx.font      = '11px "Segoe UI", sans-serif';
    ctx.fillStyle = '#86efac';
    ctx.textAlign = 'left';
    ctx.fillText(pending.desc, px + PAD, descY + 8);

    // 셀 수
    ctx.font      = '10px "Segoe UI", sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText(`${pending.cells.length}셀`, px + PAD, descY + 22);
  }

  /** 둥근 사각형 헬퍼 */
  function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ────────────────── 모듈 아이콘 & 인벤토리 ──────────────────

  /** 구조 모듈 아이콘 드로우 (translate(cx,cy) 상태에서 호출) */
  function _structureIcon(ctx, key, r, col) {
    ctx.fillStyle = col;
    ctx.strokeStyle = 'rgba(200,220,255,0.65)';
    ctx.lineWidth = 1;

    const drawPlates = (n) => {
      const h = r * 0.36, gap = r * 0.10;
      const total = n * h + (n - 1) * gap;
      for (let i = 0; i < n; i++) {
        const y = -total / 2 + i * (h + gap);
        ctx.fillRect(-r * 0.72, y, r * 1.44, h);
        ctx.strokeRect(-r * 0.72, y, r * 1.44, h);
      }
    };

    switch (key) {
      case 'HULL_1': drawPlates(1); break;
      case 'HULL_2': drawPlates(2); break;
      case 'HULL_3': drawPlates(3); break;

      case 'THRUSTER': {
        ctx.beginPath(); ctx.moveTo(0,-r*.75); ctx.lineTo(-r*.45,r*.3); ctx.lineTo(r*.45,r*.3); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle='#fb923c'; ctx.beginPath(); ctx.moveTo(-r*.22,r*.3); ctx.lineTo(r*.22,r*.3); ctx.lineTo(0,r*.78); ctx.closePath(); ctx.fill();
        break;
      }
      case 'THRUSTER_2': {
        for (const dx of [-r*.38, r*.38]) {
          ctx.beginPath(); ctx.moveTo(dx,-r*.68); ctx.lineTo(dx-r*.27,r*.25); ctx.lineTo(dx+r*.27,r*.25); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle='#fb923c'; ctx.beginPath(); ctx.moveTo(dx-r*.15,r*.25); ctx.lineTo(dx+r*.15,r*.25); ctx.lineTo(dx,r*.6); ctx.closePath(); ctx.fill();
          ctx.fillStyle = col;
        }
        break;
      }
      case 'WING_L': {
        ctx.beginPath(); ctx.moveTo(r*.3,-r*.72); ctx.lineTo(-r*.72,r*.28); ctx.lineTo(-r*.1,r*.72); ctx.lineTo(r*.72,r*.1); ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      }
      case 'WING_R': {
        ctx.beginPath(); ctx.moveTo(-r*.3,-r*.72); ctx.lineTo(r*.72,r*.28); ctx.lineTo(r*.1,r*.72); ctx.lineTo(-r*.72,r*.1); ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      }
      case 'WING_HEAVY': {
        ctx.beginPath(); ctx.moveTo(0,-r*.82); ctx.lineTo(-r*.82,r*.42); ctx.lineTo(-r*.48,r*.72); ctx.lineTo(r*.5,-r*.12); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle='rgba(200,220,255,0.9)'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(-r*.32,r*.52); ctx.lineTo(r*.32,-r*.52); ctx.stroke();
        break;
      }
      case 'GUN_1': {
        ctx.beginPath(); ctx.arc(-r*.1,r*.15,r*.34,0,Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.fillRect(-r*.12,-r*.78,r*.24,r*.9); ctx.strokeRect(-r*.12,-r*.78,r*.24,r*.9);
        break;
      }
      case 'GUN_2': {
        for (const dx of [-r*.22,r*.22]) {
          ctx.beginPath(); ctx.arc(dx,r*.15,r*.2,0,Math.PI*2); ctx.fill(); ctx.stroke();
          ctx.fillRect(dx-r*.12,-r*.78,r*.22,r*.9); ctx.strokeRect(dx-r*.12,-r*.78,r*.22,r*.9);
        }
        break;
      }
      case 'REACTOR': {
        ctx.beginPath();
        for (let i=0;i<6;i++){const a=i*Math.PI/3-Math.PI/6;i?ctx.lineTo(Math.cos(a)*r*.72,Math.sin(a)*r*.72):ctx.moveTo(Math.cos(a)*r*.72,Math.sin(a)*r*.72);}
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle='#a78bfa'; ctx.beginPath(); ctx.arc(0,0,r*.3,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='#c4b5fd'; ctx.lineWidth=.7; ctx.beginPath(); ctx.arc(0,0,r*.52,0,Math.PI*2); ctx.stroke();
        break;
      }
      case 'SHIELD_CELL': {
        ctx.beginPath();
        for (let i=0;i<5;i++){const a=i*Math.PI*2/5-Math.PI/2;i?ctx.lineTo(Math.cos(a)*r*.8,Math.sin(a)*r*.8):ctx.moveTo(Math.cos(a)*r*.8,Math.sin(a)*r*.8);}
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle='#a78bfa'; ctx.lineWidth=1.5;
        ctx.beginPath();
        for (let i=0;i<5;i++){const a=i*Math.PI*2/5-Math.PI/2;i?ctx.lineTo(Math.cos(a)*r*.46,Math.sin(a)*r*.46):ctx.moveTo(Math.cos(a)*r*.46,Math.sin(a)*r*.46);}
        ctx.closePath(); ctx.stroke();
        break;
      }
      case 'REINFORCED_HULL': {
        ctx.fillRect(-r*.72,-r*.72,r*1.44,r*1.44); ctx.strokeRect(-r*.72,-r*.72,r*1.44,r*1.44);
        ctx.strokeStyle='rgba(200,220,255,0.55)'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(-r*.6,-r*.6); ctx.lineTo(r*.6,r*.6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(r*.6,-r*.6); ctx.lineTo(-r*.6,r*.6); ctx.stroke();
        break;
      }
      case 'TWIN_GUN': {
        for (const dx of [-r*.35,0,r*.35]) {
          ctx.beginPath(); ctx.arc(dx,r*.2,r*.17,0,Math.PI*2); ctx.fill(); ctx.stroke();
          ctx.fillRect(dx-r*.1,-r*.72,r*.2,r*.9); ctx.strokeRect(dx-r*.1,-r*.72,r*.2,r*.9);
        }
        break;
      }
      case 'OVERCLOCK': {
        const teeth=8,ro=r*.78,ri=r*.54,ir=r*.27;
        ctx.beginPath();
        for(let i=0;i<teeth*2;i++){const a=i*Math.PI/teeth;const rad=i%2===0?ro:ri;i?ctx.lineTo(Math.cos(a)*rad,Math.sin(a)*rad):ctx.moveTo(Math.cos(a)*rad,Math.sin(a)*rad);}
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle='#0f172a'; ctx.beginPath(); ctx.arc(0,0,ir,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle=col; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(0,0,ir,0,Math.PI*2); ctx.stroke();
        break;
      }
      case 'FURY_CORE': {
        ctx.beginPath(); ctx.moveTo(0,-r*.82); ctx.lineTo(r*.55,0); ctx.lineTo(0,r*.82); ctx.lineTo(-r*.55,0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle='#ef4444'; ctx.lineWidth=1;
        for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.55,Math.sin(a)*r*.55);ctx.lineTo(Math.cos(a)*r*.88,Math.sin(a)*r*.88);ctx.stroke();}
        break;
      }
      case 'TITAN_HULL': {
        drawPlates(3);
        ctx.fillStyle='rgba(200,220,255,0.3)';
        for(const p of[[-r*.5,-r*.52],[r*.5,-r*.52],[-r*.5,0],[r*.5,0],[-r*.5,r*.52],[r*.5,r*.52]]){
          ctx.beginPath(); ctx.arc(p[0],p[1],r*.07,0,Math.PI*2); ctx.fill();
        }
        break;
      }
      default: drawPlates(1); break;
    }
  }

  /** 무기 모듈 아이콘 드로우 (translate(cx,cy) 상태에서 호출) */
  function _weaponIcon(ctx, key, r, col) {
    ctx.fillStyle = col;
    ctx.strokeStyle = 'rgba(200,220,255,0.65)';
    ctx.lineWidth = 1;

    switch (key) {
      case 'WPN_GATLING': {
        for(let i=0;i<3;i++){const a=i*Math.PI*2/3;ctx.beginPath();ctx.arc(Math.cos(a)*r*.38,Math.sin(a)*r*.38,r*.28,0,Math.PI*2);ctx.fill();ctx.stroke();}
        ctx.fillStyle='#0f172a'; ctx.beginPath(); ctx.arc(0,0,r*.22,0,Math.PI*2); ctx.fill();
        break;
      }
      case 'WPN_FLAK': {
        ctx.beginPath();
        for(let i=0;i<8;i++){const a=i*Math.PI/4;const rad=i%2===0?r*.8:r*.36;i?ctx.lineTo(Math.cos(a)*rad,Math.sin(a)*rad):ctx.moveTo(Math.cos(a)*rad,Math.sin(a)*rad);}
        ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      }
      case 'WPN_LASER': {
        ctx.shadowColor=col; ctx.shadowBlur=8;
        ctx.strokeStyle=col; ctx.lineWidth=3;
        ctx.beginPath(); ctx.moveTo(-r*.86,0); ctx.lineTo(r*.86,0); ctx.stroke();
        ctx.strokeStyle='#fff'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(-r*.86,0); ctx.lineTo(r*.86,0); ctx.stroke();
        ctx.shadowBlur=0;
        break;
      }
      case 'WPN_SPREAD': {
        ctx.strokeStyle=col; ctx.lineWidth=1.5;
        for(let i=-2;i<=2;i++){const a=(i/2.5)*(Math.PI/4);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*r*.88,Math.sin(a)*r*.88);ctx.stroke();}
        break;
      }
      case 'WPN_MISSILE': {
        ctx.beginPath(); ctx.moveTo(0,-r*.82); ctx.quadraticCurveTo(r*.3,-r*.38,r*.22,r*.5); ctx.lineTo(-r*.22,r*.5); ctx.quadraticCurveTo(-r*.3,-r*.38,0,-r*.82); ctx.closePath(); ctx.fill(); ctx.stroke();
        for(const s of[1,-1]){ctx.beginPath();ctx.moveTo(s*r*.22,r*.28);ctx.lineTo(s*r*.6,r*.65);ctx.lineTo(s*r*.22,r*.65);ctx.closePath();ctx.fill();}
        break;
      }
      case 'WPN_ORBIT': {
        ctx.strokeStyle=col; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.arc(0,0,r*.65,0,Math.PI*2); ctx.stroke();
        ctx.fillStyle=col;
        for(let i=0;i<3;i++){const a=i*Math.PI*2/3;ctx.beginPath();ctx.arc(Math.cos(a)*r*.65,Math.sin(a)*r*.65,r*.16,0,Math.PI*2);ctx.fill();}
        ctx.fillStyle='rgba(200,220,255,0.55)'; ctx.beginPath(); ctx.arc(0,0,r*.12,0,Math.PI*2); ctx.fill();
        break;
      }
      case 'WPN_MINE': {
        ctx.beginPath(); ctx.arc(0,0,r*.44,0,Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle=col; ctx.lineWidth=1.5;
        for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.44,Math.sin(a)*r*.44);ctx.lineTo(Math.cos(a)*r*.82,Math.sin(a)*r*.82);ctx.stroke();}
        break;
      }
      case 'WPN_SNIPER': {
        ctx.fillRect(-r*.1,-r*.9,r*.2,r*1.62); ctx.strokeRect(-r*.1,-r*.9,r*.2,r*1.62);
        ctx.fillStyle='rgba(200,220,255,0.45)'; ctx.fillRect(-r*.24,r*.18,r*.48,r*.22);
        break;
      }
      case 'WPN_CHAIN': {
        ctx.lineWidth=2.5; ctx.strokeStyle=col;
        for(let i=-1;i<=1;i++){ctx.beginPath();ctx.arc(i*r*.5,i*r*.06,r*.27,0,Math.PI*2);ctx.stroke();}
        break;
      }
      case 'WPN_NOVA': {
        ctx.beginPath();
        for(let i=0;i<12;i++){const a=i*Math.PI/6;const rad=i%2===0?r*.8:r*.38;i?ctx.lineTo(Math.cos(a)*rad,Math.sin(a)*rad):ctx.moveTo(Math.cos(a)*rad,Math.sin(a)*rad);}
        ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      }
      case 'WPN_PLASMA': {
        ctx.shadowColor=col; ctx.shadowBlur=10;
        ctx.beginPath(); ctx.arc(0,0,r*.56,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        ctx.strokeStyle='rgba(255,255,255,0.72)'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.arc(0,0,r*.36,Math.PI*.2,Math.PI*1.18); ctx.stroke();
        ctx.beginPath(); ctx.arc(r*.08,r*.08,r*.22,Math.PI*1.18,Math.PI*2.1); ctx.stroke();
        break;
      }
      case 'WPN_RAILGUN': {
        ctx.fillRect(-r*.86,-r*.12,r*1.72,r*.24); ctx.strokeRect(-r*.86,-r*.12,r*1.72,r*.24);
        ctx.strokeStyle='#7dd3fc'; ctx.lineWidth=1;
        for(const x of[-r*.52,0,r*.52]){ctx.beginPath();ctx.arc(x,0,r*.22,-Math.PI*.62,Math.PI*.62);ctx.stroke();ctx.beginPath();ctx.arc(x,0,r*.22,Math.PI*.38,Math.PI*1.62);ctx.stroke();}
        break;
      }
      case 'WPN_TYPHOON': {
        ctx.strokeStyle=col; ctx.lineWidth=2.2;
        ctx.beginPath();
        for(let i=0;i<=70;i++){const a=i*Math.PI/13;const rad=r*.09*(i/9);if(rad>r*.86)break;i?ctx.lineTo(Math.cos(a)*rad,Math.sin(a)*rad):ctx.moveTo(Math.cos(a)*rad,Math.sin(a)*rad);}
        ctx.stroke();
        break;
      }
      case 'WPN_ANNIHILATOR': {
        ctx.strokeStyle=col; ctx.lineWidth=r*.3; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(-r*.65,-r*.65); ctx.lineTo(r*.65,r*.65); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(r*.65,-r*.65); ctx.lineTo(-r*.65,r*.65); ctx.stroke();
        ctx.lineCap='butt';
        break;
      }
      case 'WPN_OMEGA': {
        ctx.font=`bold ${Math.round(r*1.55)}px serif`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillStyle=col; ctx.fillText('Ω',0,r*.1);
        break;
      }
      default: {
        // 기본: 총구 원
        ctx.beginPath(); ctx.arc(0,0,r*.55,0,Math.PI*2); ctx.fill(); ctx.stroke();
        break;
      }
    }
  }

  /** 모듈 아이콘 드로우 (공개용 — 인벤토리 카드에서 호출) */
  function _drawModuleIcon(ctx, typeKey, cx, cy, sz) {
    const def = MODULE_DEFS[typeKey];
    if (!def) return;
    const r = sz * 0.44;
    ctx.save();
    ctx.translate(cx, cy);
    // 원형 배경
    ctx.beginPath(); ctx.arc(0,0,r*1.1,0,Math.PI*2);
    ctx.fillStyle='rgba(0,0,0,0.38)'; ctx.fill();
    if (typeKey.startsWith('WPN_')) _weaponIcon(ctx, typeKey, r, def.color);
    else _structureIcon(ctx, typeKey, r, def.color);
    ctx.restore();
  }

  // ── 인벤토리 섹션 드로우 헬퍼
  function _drawInvSection(ctx, sx, sy, sw, sh, title, items, isPlaced = false) {
    const CARD_W = 78, CARD_H = 92, GAP = 5;
    const cols = Math.max(1, Math.floor((sw) / (CARD_W + GAP)));

    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    ctx.fillStyle = '#7dd3fc';
    ctx.fillText(`${title}  (${items.length}개)`, sx, sy + 8);

    const startY = sy + 22;
    const maxH = sh - 22;

    if (items.length === 0) {
      ctx.font = '11px "Segoe UI", sans-serif';
      ctx.fillStyle = '#334466';
      ctx.textAlign = 'center';
      ctx.fillText('없음', sx + sw / 2, startY + 36);
      return;
    }

    let rendered = 0;
    for (let i = 0; i < items.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cardX = sx + col * (CARD_W + GAP);
      const cardY = startY + row * (CARD_H + GAP);
      if (cardY + CARD_H > startY + maxH) break;

      const typeKey = items[i];
      const def = MODULE_DEFS[typeKey];
      if (!def) continue;
      const tier = def.tier ?? 'COMMON';
      const tc   = TIER_COLORS[tier];

      // 카드 배경
      ctx.fillStyle = 'rgba(8,18,50,0.88)';
      _roundRect(ctx, cardX, cardY, CARD_W, CARD_H, 6); ctx.fill();
      ctx.strokeStyle = tc + '77'; ctx.lineWidth = 1;
      _roundRect(ctx, cardX, cardY, CARD_W, CARD_H, 6); ctx.stroke();

      // 아이콘
      _drawModuleIcon(ctx, typeKey, cardX + CARD_W / 2, cardY + 28, 44);

      // 티어 뱃지
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 8px "Segoe UI", sans-serif';
      ctx.fillStyle = tc;
      ctx.fillText(TIER_LABELS[tier], cardX + CARD_W / 2, cardY + CARD_H - 30);

      // 모듈 이름
      ctx.font = 'bold 9px "Segoe UI", sans-serif';
      ctx.fillStyle = '#e2e8f0';
      const name = def.name;
      ctx.fillText(name.length > 6 ? name.slice(0,5)+'…' : name, cardX + CARD_W / 2, cardY + CARD_H - 19);

      // 장갑판 HP 바 (장착 완료 섹션의 hull 모듈에만)
      if (isPlaced) {
        const placedMod = placedModules.find(m => m.type === typeKey);
        if (placedMod && placedMod.maxHp > 0) {
          const ratio = Math.max(0, placedMod.hp / placedMod.maxHp);
          const bx = cardX + 6, by = cardY + CARD_H - 11;
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(bx, by, CARD_W - 12, 4);
          ctx.fillStyle = ratio > 0.5 ? '#4ade80' : ratio > 0.25 ? '#fbbf24' : '#ef4444';
          ctx.fillRect(bx, by, (CARD_W - 12) * ratio, 4);
          ctx.font = '7px "Segoe UI", sans-serif';
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(`${Math.ceil(placedMod.hp)}/${placedMod.maxHp}`, cardX + CARD_W / 2, cardY + CARD_H - 4);
        } else if (placedMod && placedMod.maxHp === 0) {
          ctx.font = '7px "Segoe UI", sans-serif';
          ctx.fillStyle = '#f87171';
          ctx.fillText('노출됨', cardX + CARD_W / 2, cardY + CARD_H - 6);
        }
      } else {
        // 대기 중 모듈: 구조/무기 구분 표시
        ctx.font = '7px "Segoe UI", sans-serif';
        ctx.fillStyle = typeKey.startsWith('WPN_') ? '#f87171' : '#86efac';
        ctx.fillText(typeKey.startsWith('WPN_') ? '무기' : '구조', cardX + CARD_W / 2, cardY + CARD_H - 6);
      }
      rendered++;
    }

    const maxVisible = cols * Math.floor(maxH / (CARD_H + GAP));
    if (items.length > maxVisible) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '10px "Segoe UI", sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText(`+${items.length - maxVisible}개 더`, sx + sw / 2, sy + sh - 8);
    }
  }

  /**
   * 모듈 인벤토리 패널 드로우 (Game.js render()에서 inventoryOpen 시 호출)
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} W - 캔버스 너비
   * @param {number} H - 캔버스 높이
   */
  function drawInventory(ctx, W, H) {
    const PW  = Math.min(W - 40, 800);
    const PH  = Math.min(H - 50, 540);
    const px  = (W - PW) / 2;
    const py  = (H - PH) / 2;
    const PAD = 14;
    const RAD = 14;

    // 패널 배경
    ctx.fillStyle = 'rgba(4,8,28,0.96)';
    _roundRect(ctx, px, py, PW, PH, RAD); ctx.fill();
    ctx.strokeStyle = 'rgba(100,160,255,0.32)'; ctx.lineWidth = 1;
    _roundRect(ctx, px, py, PW, PH, RAD); ctx.stroke();

    // 헤더
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px "Segoe UI", sans-serif';
    ctx.fillStyle = '#93c5fd';
    ctx.fillText('모듈 인벤토리', W / 2, py + PAD + 8);
    ctx.font = '10px "Segoe UI", sans-serif';
    ctx.fillStyle = '#334466';
    ctx.fillText('[I] 또는 [ESC] 닫기', W / 2, py + PAD + 24);

    const headerH = 50;
    ctx.strokeStyle = 'rgba(100,160,255,0.18)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px + PAD, py + headerH); ctx.lineTo(px + PW - PAD, py + headerH); ctx.stroke();

    // 범례 (우상단)
    const legendX = px + PW - 160, legendY = py + 8;
    const tiers = ['COMMON','RARE','EPIC','LEGENDARY'];
    const labels = ['일반','희귀','에픽','전설'];
    ctx.font = '9px "Segoe UI", sans-serif';
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = TIER_COLORS[tiers[i]];
      ctx.textAlign = 'left';
      ctx.fillText(`★ ${labels[i]}`, legendX + (i < 2 ? 0 : 76), legendY + (i % 2) * 14 + 4);
    }

    // 두 섹션 분할
    const bodyY = py + headerH + PAD;
    const bodyH = PH - headerH - PAD * 2;
    const colW  = (PW - PAD * 3) / 2;

    // 대기 중: moduleQueue + pending
    const queueItems = [...(pending ? [pending.type] : []), ...moduleQueue];
    _drawInvSection(ctx, px + PAD, bodyY, colW, bodyH, '대기 중', queueItems);

    // 중앙 구분선
    const divX = px + PAD * 2 + colW;
    ctx.strokeStyle = 'rgba(100,160,255,0.15)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(divX, bodyY); ctx.lineTo(divX, bodyY + bodyH); ctx.stroke();

    // 장착 완료
    const placedTypes = placedModules.map(m => m.type);
    _drawInvSection(ctx, divX + PAD, bodyY, colW, bodyH, '장착 완료', placedTypes, true);
  }

  /** 장갑판 전체 내구도를 최대로 회복 (업그레이드: 긴급 수리) */
  function repairAllHull() {
    for (const mod of placedModules) {
      if (mod.maxHp > 0) mod.hp = mod.maxHp;
    }
  }

  /** 현재 장착된 장갑판 최대 내구도를 비율(mult)만큼 증폭 (업그레이드: 장갑 강화) */
  function boostHullMaxHp(mult) {
    for (const mod of placedModules) {
      if (mod.maxHp > 0) {
        const added = Math.ceil(mod.maxHp * (mult - 1));
        mod.maxHp += added;
        mod.hp = Math.min(mod.hp + added, mod.maxHp);
      }
    }
  }

  /** 그리드 Map 읽기 전용 반환 (Player.getHitPolygons() 에서 모듈 셀 좌표 참조용) */
  function getGrid() { return grid; }

  // ── 공개 API
  return {
    init,
    offerRandom,
    randomModuleKey,
    queueModule,
    queueRandomModule,
    nextModule,
    hasQueued,
    getQueueSize,
    getGrid,
    canPlace,
    place,
    recalcHitbox,
    rotatePending,
    handleClick,
    tryStartDrag,
    endDrag,
    isDragging,
    hitShip,
    updateFlash,
    drawShipModules,
    drawOnCanvas,
    drawInventory,
    repairAllHull,
    boostHullMaxHp,
    // 함체 슬롯 시스템
    expandHullSlots,
    getUsedSlots,
    getMaxSlots,
    getExpandCost,
    getExpandAmount,
  };

})();

window.TetrisGrid = TetrisGrid;
