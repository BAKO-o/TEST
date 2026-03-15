/**
 * Collision.js — 충돌 판정 유틸리티 모듈
 * Circle-Circle 충돌이 핵심이며, wraparound 맵에 대응한다.
 * v0.5.0: 볼록 다각형-원 충돌 추가 (선체 정확 히트박스용)
 */

const Collision = (() => {

  /**
   * 두 원의 충돌 여부 (일반 평면)
   */
  function circleCircle(ax, ay, ar, bx, by, br) {
    const dx = ax - bx;
    const dy = ay - by;
    const distSq = dx * dx + dy * dy;
    const radSum = ar + br;
    return distSq <= radSum * radSum;
  }

  /**
   * Wraparound 맵을 고려한 두 엔티티의 최단 거리 (제곱)
   */
  function wrappedDistSq(ax, ay, bx, by, worldW, worldH) {
    let dx = Math.abs(ax - bx);
    let dy = Math.abs(ay - by);
    if (dx > worldW * 0.5) dx = worldW - dx;
    if (dy > worldH * 0.5) dy = worldH - dy;
    return dx * dx + dy * dy;
  }

  /**
   * Wraparound 맵을 고려한 두 원의 충돌 여부
   */
  function circleCircleWrapped(ax, ay, ar, bx, by, br, worldW, worldH) {
    const distSq = wrappedDistSq(ax, ay, bx, by, worldW, worldH);
    const radSum = ar + br;
    return distSq <= radSum * radSum;
  }

  /**
   * 두 엔티티 간 Wraparound 방향벡터 (정규화 전, dx dy 반환)
   */
  function wrappedDelta(ax, ay, bx, by, worldW, worldH) {
    let dx = bx - ax;
    let dy = by - ay;
    if (dx >  worldW * 0.5) dx -= worldW;
    if (dx < -worldW * 0.5) dx += worldW;
    if (dy >  worldH * 0.5) dy -= worldH;
    if (dy < -worldH * 0.5) dy += worldH;
    return { dx, dy };
  }

  // ────────────── 볼록 다각형-원 충돌 (선체 히트박스) ──────────────

  /** 점과 선분 사이의 거리 제곱 */
  function _pointSegDistSq(px, py, ax, ay, bx, by) {
    const ex = bx - ax, ey = by - ay;
    const lenSq = ex * ex + ey * ey;
    if (lenSq === 0) return (px - ax) ** 2 + (py - ay) ** 2;
    const t = Math.max(0, Math.min(1, ((px - ax) * ex + (py - ay) * ey) / lenSq));
    return (px - ax - t * ex) ** 2 + (py - ay - t * ey) ** 2;
  }

  /** 점이 볼록 다각형 내부에 있는지 (크로스 프로덕트 부호 검사) */
  function _pointInConvexPoly(verts, px, py) {
    let sign = 0;
    const n = verts.length;
    for (let i = 0; i < n; i++) {
      const a = verts[i], b = verts[(i + 1) % n];
      const cross = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
      if (cross === 0) continue;
      const s = cross > 0 ? 1 : -1;
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
    return true;
  }

  /**
   * 볼록 다각형과 원의 충돌 판정
   * @param {Array<{x,y}>} verts - 볼록 다각형 정점 (3개 이상)
   * @param {number} cx, cy - 원 중심
   * @param {number} r - 원 반지름
   * @returns {boolean}
   */
  function polyCircle(verts, cx, cy, r) {
    if (_pointInConvexPoly(verts, cx, cy)) return true;
    const n = verts.length;
    for (let i = 0; i < n; i++) {
      const a = verts[i], b = verts[(i + 1) % n];
      if (_pointSegDistSq(cx, cy, a.x, a.y, b.x, b.y) < r * r) return true;
    }
    return false;
  }

  /**
   * Wraparound 맵을 고려한 볼록 다각형-원 충돌 판정
   * @param {Array<{x,y}>} verts - 볼록 다각형 정점 (월드 좌표)
   * @param {number} cx, cy - 원 중심 (월드 좌표)
   * @param {number} r - 원 반지름
   */
  function polyCircleWrapped(verts, cx, cy, r, worldW, worldH) {
    // 9방향 오프셋 적용 (wrap-around 대응)
    for (const ox of [0, worldW, -worldW]) {
      for (const oy of [0, worldH, -worldH]) {
        if (polyCircle(verts, cx + ox, cy + oy, r)) return true;
      }
    }
    return false;
  }

  return {
    circleCircle,
    wrappedDistSq,
    circleCircleWrapped,
    wrappedDelta,
    polyCircle,
    polyCircleWrapped,
  };
})();

window.Collision = Collision;
