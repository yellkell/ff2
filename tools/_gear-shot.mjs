import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('http://localhost:5173/env-preview.html', { waitUntil: 'domcontentloaded' }).catch(() => {});
const res = await page.evaluate(async (gearSet) => {
  document.body.innerHTML = '';
  const T = await import('/node_modules/.vite/deps/three.js');
  const P = await import('/src/avatar/paint.ts');
  const B = await import('/src/avatar/boxer.ts');
  const G = await import('/src/avatar/gear.ts');
  const S = await import('/src/avatar/skins.ts');
  const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(800, 600);
  document.body.appendChild(renderer.domElement);
  const scene = new T.Scene();
  scene.background = new T.Color(0x303038);
  scene.add(new T.HemisphereLight(0xffffff, 0x444444, 2.2));
  const dl = new T.DirectionalLight(0xffffff, 1.5); dl.position.set(1, 2, -3); scene.add(dl);
  const rig = B.buildBoxer(0);
  const fig = new T.Group(); fig.name = 'fig';
  for (const piece of rig.all) { piece.visible = true; fig.add(piece); }
  B.solveTorso(rig, new T.Vector3(0, 1.5, 0), new T.Quaternion(), 0, 0, new T.Vector3(), new T.Vector3(), undefined, true);
  rig.gloves[0].position.set(-0.22, 1.12, -0.28);
  rig.gloves[1].position.set(0.22, 1.12, -0.28);
  scene.add(fig);
  S.applyAvatarSkin?.(fig, S.resolveAvatarSkin ? S.resolveAvatarSkin('blank') : undefined);
  G.applyGear(fig, gearSet, 'white');
  fig.updateMatrixWorld(true);
  const paintMeshes = []; fig.traverse((o) => { if (o.userData.paintPart) paintMeshes.push(o); });
  // Aim from the front at a world point; return what the ray hits.
  const ray = new T.Raycaster();
  const hitAt = (from, to) => {
    const o = new T.Vector3(...from); const d = new T.Vector3(...to).sub(o).normalize();
    ray.set(o, d);
    const h = ray.intersectObjects(paintMeshes, false)[0];
    return h ? { part: h.object.userData.paintPart, u: h.uv.x, v: h.uv.y, map: h.object.userData.paintMap, pt: h.point.toArray().map((n) => +n.toFixed(3)) } : null;
  };
  const out = { hits: {} };
  const look = { paint: [] };
  const add = (name, h, kind, len, colour, angle = 0, wid = 0.5) => { out.hits[name] = h && { part: h.part, pt: h.pt }; if (h) look.paint.push({ kind, part: h.part, u: h.u, v: h.v, angle, len, wid, colour, variant: 0 }); return h; };
  // The body sits at hips ~0.86 (1.5 - NECK_SEAT). Left pad = +x side (the fig's own left faces the camera's right? just aim at +x).
  const hipY = rig.body.position.y;
  const L = add('leftPad', hitAt([0.6, hipY + 0.55, -0.8], [0.215, hipY + 0.42, 0]), 'dot', 0.25, 9);
  const R = hitAt([-0.6, hipY + 0.55, -0.8], [-0.215, hipY + 0.42, 0]);
  out.hits.rightPad = R && { part: R.part, pt: R.pt };
  add('chest', hitAt([0, hipY + 0.3, -1], [0, hipY + 0.3, 0]), 'stripe', 0.6, 11, 0, 0.18);
  add('crest', hitAt([0.8, 1.69, 0.0], [0, 1.69, 0.0]), 'stripe', 0.5, 19, 0, 0.12);
  add('plate', hitAt([0.25, hipY + 0.33, -1], [0.07, hipY + 0.33, 0]), 'triangle', 0.35, 13, 0);
  out.plateAgain = hitAt([0.25, hipY + 0.33, -1], [0.07, hipY + 0.33, 0])?.part;
  P.setLook(look);
  P.applyLook(fig, look);
  out.rightPadPicks = R ? P.unitAt(R.part, R.u, R.v, R.map) : 'no hit';
  out.leftPadPicks = L ? P.unitAt(L.part, L.u, L.v, L.map) : 'no hit';
  const cam = new T.PerspectiveCamera(30, 800 / 600, 0.1, 10);
  for (const [name, yaw, y, dist] of [['front', 0, 1.25, 2.0], ['left', -0.9, 1.3, 1.6], ['right', 0.9, 1.3, 1.6], ['head', 1.2, 1.55, 1.0]]) {
    cam.position.set(Math.sin(yaw) * dist, y, -Math.cos(yaw) * dist);
    cam.lookAt(0, y - 0.05, 0);
    renderer.render(scene, cam);
    out['img_' + name] = renderer.domElement.toDataURL('image/png');
  }
  return out;
}, process.argv[3] ? process.argv[3].split(',') : ['crest', 'pauldrons', 'cuffs']);
for (const [k, v] of Object.entries(res)) if (k.startsWith('img_')) writeFileSync(`${out}/gear-${k.slice(4)}.png`, Buffer.from(v.split(',')[1], 'base64'));
console.log(JSON.stringify(Object.fromEntries(Object.entries(res).filter(([k]) => !k.startsWith('img_')))));
await browser.close();
