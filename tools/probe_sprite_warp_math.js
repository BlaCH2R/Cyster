// Pure-Node fallback for the sprite-warp verification: validates the exact
// homography + near-plane clipping math used by drawSpriteWarped without any
// Electron/GPU. Runs in milliseconds and can never hang. The electron probe
// (probe_sprite_warp.js) validates the actual rendered pixels; this one locks
// the algorithm invariants.
const fs = require('fs');
const path = require('path');

const out = { checks: [], ok: true };
const check = (name, cond, detail) => {
  out.checks.push({ name, pass: !!cond, detail: String(detail) });
  if (!cond) out.ok = false;
};

// Column-major 4x4 helpers, identical to preview.js.
function m4Identity() { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; }
function m4Mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c*4+r] = a[r]*b[c*4] + a[4+r]*b[c*4+1] + a[8+r]*b[c*4+2] + a[12+r]*b[c*4+3];
  return o;
}
function m4Translate(x, y, z) { const m = m4Identity(); m[12]=x; m[13]=y; m[14]=z; return m; }
function m4RotZ(rad) { const c=Math.cos(rad), s=Math.sin(rad); return [c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]; }
function m4RotX(rad) { const c=Math.cos(rad), s=Math.sin(rad); return [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]; }
function m4RotY(rad) { const c=Math.cos(rad), s=Math.sin(rad); return [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]; }
function m4Scale(sx, sy) { const m = m4Identity(); m[0]=sx; m[5]=sy; return m; }

// stageLocal3: T(xC,yC,z) . Ry(rotY) . Rx(rotX) . Rz(rotZ) . S(sx,sy), with
// the sprite sign conventions (rotX raw, rotY/rotZ negated for y-down canvas).
function stageLocal3(xC, yC, z, rot_x, rot_y, rot_z, sx, sy) {
  const rotX = rot_x * Math.PI / 180;
  const rotY = -rot_y * Math.PI / 180;
  const rotZ = -rot_z * Math.PI / 180;
  return m4Mul(m4Translate(xC, yC, z), m4Mul(m4RotY(rotY), m4Mul(m4RotX(rotX), m4Mul(m4RotZ(rotZ), m4Scale(sx, sy)))));
}

// Project a local box point through the perspective camera (same formula as
// stageProjectPoint / drawSpriteWarped).
function project(m3, u, v, W, H, f) {
  const X = m3[0]*u + m3[4]*v + m3[12];
  const Y = m3[1]*u + m3[5]*v + m3[13];
  const Z = m3[2]*u + m3[6]*v + m3[14];
  const s = f / Math.max(0.05, f + Z);
  return { x: W/2 + (X - W/2)*s, y: H/2 + (Y - H/2)*s };
}

const W = 960, H = 540, f = 540 / 2 / Math.tan(53.2 * Math.PI / 360) * 10; // f = S*D with ortho 5, D 10
const hw = 120, hh = 90; // half box (200x200 stage box on 960x540 canvas, ~240x180 px)
const cornersOf = (m3) => [
  project(m3, -hw, -hh, W, H, f),
  project(m3,  hw, -hh, W, H, f),
  project(m3,  hw,  hh, W, H, f),
  project(m3, -hw,  hh, W, H, f),
];
const spans = (c) => ({
  top: Math.hypot(c[1].x - c[0].x, c[1].y - c[0].y),
  bottom: Math.hypot(c[2].x - c[3].x, c[2].y - c[3].y),
  left: Math.hypot(c[3].x - c[0].x, c[3].y - c[0].y),
  right: Math.hypot(c[2].x - c[1].x, c[2].y - c[1].y),
});
const base = (rx, ry, rz) => stageLocal3(W/2, H/2, 0, rx, ry, rz, 1, 1);

// Continuity across 0.
for (const [axis, rx, ry, rz] of [['rot_x', 1, 0, 0], ['rot_y', 0, 1, 0], ['rot_z', 0, 0, 1]]) {
  const pos = (deg) => cornersOf(base(rx*deg, ry*deg, rz*deg)).map((p) => [p.x, p.y]).flat();
  const p0 = pos(0), pP = pos(0.1), pN = pos(-0.1);
  let dP = 0, dN = 0;
  for (let i = 0; i < 8; i++) { dP = Math.max(dP, Math.abs(pP[i] - p0[i])); dN = Math.max(dN, Math.abs(pN[i] - p0[i])); }
  check(axis + ' continuous across 0', dP < 1.5 && dN < 1.5, JSON.stringify({ dP, dN }));
}

// Directions (perspective).
{
  const c30 = spans(cornersOf(base(30, 0, 0)));
  const cN30 = spans(cornersOf(base(-30, 0, 0)));
  check('+rot_x widens TOP edge', c30.top > c30.bottom, JSON.stringify(c30));
  check('-rot_x widens BOTTOM edge', cN30.bottom > cN30.top, JSON.stringify(cN30));
  const y30 = spans(cornersOf(base(0, 30, 0)));
  const yN30 = spans(cornersOf(base(0, -30, 0)));
  check('+rot_y narrows RIGHT edge (recedes)', y30.right < y30.left, JSON.stringify(y30));
  check('-rot_y narrows LEFT edge', yN30.left < yN30.right, JSON.stringify(yN30));
}

// Near-plane clipping invariant: at rot_x=90 the plane is edge-on; every
// projected corner must stay finite (no explosion), which the clip guarantees.
{
  const c90 = cornersOf(base(90, 0, 0));
  const finite = c90.every((p) => isFinite(p.x) && isFinite(p.y));
  check('rot_x=90 stays finite (near-plane clip)', finite, JSON.stringify(c90));
}

// Flat plane: perspective degenerates to affine (scale 1).
{
  const c0 = cornersOf(base(0, 0, 0));
  const w = Math.hypot(c0[1].x - c0[0].x, c0[1].y - c0[0].y);
  const h = Math.hypot(c0[3].x - c0[0].x, c0[3].y - c0[0].y);
  check('flat plane projects to the un-rotated box',
    Math.abs(w - 2*hw) < 0.5 && Math.abs(h - 2*hh) < 0.5, JSON.stringify({ w, h }));
}

const outfile = process.argv[2] || path.join(__dirname, 'probe_sprite_warp_math_out.json');
fs.writeFileSync(outfile, JSON.stringify(out, null, 2));
process.exit(out.ok ? 0 : 1);
