// Shared capture plumbing for the FIRE FIGHT 2 trailer.
//
// Boots the game in headless Chromium with the GPU on, hides the IWER
// emulator's debug furniture, and records the app canvas with the CDP
// screencast into a folder of JPEG frames + a stamps.json (seconds,
// relative to the first frame).

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const base = process.env.PREVIEW_BASE ?? 'http://localhost:5174';
export const here = dirname(fileURLToPath(import.meta.url));
export const capDir = join(here, 'cap');
export const W = 1280;
export const H = 720;

export const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

export async function launch() {
  const args = [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--ignore-certificate-errors',
    '--autoplay-policy=no-user-gesture-required',
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--use-angle=d3d11',
  ];
  return chromium.launch({ args });
}

/** A page with the arena identity planted; `init` may set more localStorage. */
export async function newPage(browser, init = {}) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.addInitScript((kv) => {
    // No HMR on a capture page. A file change anywhere in vite's module
    // graph broadcasts a full-reload; a reload attempt ends the XR session
    // (the landing comes back over a game still running underneath) even
    // when the navigation itself is cancelled. Vite's client opens its
    // socket with the 'vite-hmr' protocol, so refuse exactly that.
    const RealWS = window.WebSocket;
    window.WebSocket = function (url, protocols) {
      const p = Array.isArray(protocols) ? protocols : protocols ? [protocols] : [];
      if (p.includes('vite-hmr')) throw new Error('hmr disabled for capture');
      return protocols === undefined ? new RealWS(url) : new RealWS(url, protocols);
    };
    window.WebSocket.prototype = RealWS.prototype;
    Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
    localStorage.setItem('ff-tutorial-done', '1');
    localStorage.setItem('ff-player-name', 'YELLKELL');
    for (const [k, v] of Object.entries(kv)) {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    }
  }, init);
  return page;
}

/** Load a page, press ENTER VR, hide the emulator UI. Resolves the moment the
 *  session is up (the 6 s boot intro is still playing). */
export async function enter(page, path = '/') {
  const url = `${base}${path}`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => page.goto(url));
  await page.waitForTimeout(800);
  await page.click('#enter-vr');
  await page.waitForFunction(() => document.body.classList.contains('app-entered'), { timeout: 40000 });
  await hideDevUI(page);
}

export async function hideDevUI(page) {
  await page.evaluate(() => {
    const d = window.IWER_DEVICE;
    const app = d?.appCanvas;
    if (!app) return;
    // 'manual' mode lets the dev UI rewrite the headset + controller poses
    // every frame; 'programmatic' makes our own writes stick.
    d.controlMode = 'programmatic';
    const keep = new Set();
    for (let e = app; e; e = e.parentElement) keep.add(e);
    for (const el of document.body.children) {
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'LINK') continue;
      if (el.id === 'landing') continue;
      if (keep.has(el)) {
        for (const c of el.querySelectorAll('canvas')) if (c !== app) c.style.display = 'none';
        for (const s of el.querySelectorAll('*')) if (s.shadowRoot) s.style.display = 'none';
        continue;
      }
      el.style.display = 'none';
    }
  });
}

/** Camera (the emulated headset): position + look-at or yaw/pitch. */
export async function cam(page, pos, look) {
  await page.evaluate(({ pos, look }) => {
    const d = window.IWER_DEVICE;
    d.position.set(pos[0], pos[1], pos[2]);
    if (look) {
      // quaternion looking from pos toward look (yaw about Y, then pitch about X)
      const dx = look[0] - pos[0], dy = look[1] - pos[1], dz = look[2] - pos[2];
      const yaw = Math.atan2(-dx, -dz);
      const pitch = Math.atan2(dy, Math.hypot(dx, dz));
      const cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2);
      const cp = Math.cos(pitch / 2), sp = Math.sin(pitch / 2);
      // q = qyaw * qpitch  (yaw about Y, pitch about X)
      d.quaternion.set(cy * sp, sy * cp, -sy * sp, cy * cp);
    }
  }, { pos, look });
}

/** Install a page-side camera flight: from → to over `seconds`, eased,
 *  optionally orbiting. Returns immediately; the flight runs in the page. */
export async function flyCam(page, spec) {
  await page.evaluate((spec) => {
    const d = window.IWER_DEVICE;
    const lookQ = (pos, look) => {
      const dx = look[0] - pos[0], dy = look[1] - pos[1], dz = look[2] - pos[2];
      const yaw = Math.atan2(-dx, -dz);
      const pitch = Math.atan2(dy, Math.hypot(dx, dz));
      const cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2);
      const cp = Math.cos(pitch / 2), sp = Math.sin(pitch / 2);
      return [cy * sp, sy * cp, -sy * sp, cy * cp];
    };
    const ease = (t) => (spec.ease === 'linear' ? t : t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    const t0 = performance.now();
    if (window.__flyStop) window.__flyStop();
    let stopped = false;
    window.__flyStop = () => { stopped = true; };
    const step = () => {
      if (stopped) return;
      const t = Math.min(1, (performance.now() - t0) / (spec.seconds * 1000));
      const k = ease(t);
      let pos;
      if (spec.orbit) {
        // orbit around `center` at radius r, height y, angle a0→a1
        const o = spec.orbit;
        const a = o.a0 + (o.a1 - o.a0) * k;
        const y = o.y0 + ((o.y1 ?? o.y0) - o.y0) * k;
        const r = o.r0 + ((o.r1 ?? o.r0) - o.r0) * k;
        pos = [o.center[0] + Math.sin(a) * r, y, o.center[2] + Math.cos(a) * r];
      } else {
        pos = [0, 1, 2].map((i) => spec.from[i] + (spec.to[i] - spec.from[i]) * k);
      }
      d.position.set(pos[0], pos[1], pos[2]);
      const look = spec.look ?? (spec.orbit ? spec.orbit.center : null);
      if (look) {
        const l = spec.lookTo ? [0, 1, 2].map((i) => look[i] + (spec.lookTo[i] - look[i]) * k) : look;
        const q = lookQ(pos, l);
        d.quaternion.set(q[0], q[1], q[2], q[3]);
      }
      if (t < 1) requestAnimationFrame(step);
    };
    step();
  }, spec);
}

export async function stopFly(page) {
  await page.evaluate(() => window.__flyStop?.());
}

/** Reset the head to standing at the origin, looking down -Z. */
export async function camHome(page) {
  await page.evaluate(() => {
    window.__flyStop?.();
    const d = window.IWER_DEVICE;
    d.position.set(0, 1.6, 0);
    d.quaternion.set(0, 0, 0, 1);
  });
}

/** Screencast recorder. `start(name)` wipes and fills cap/<name>/. */
export async function recorder(page) {
  const cdp = await page.context().newCDPSession(page);
  let active = null;
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    if (active) {
      const i = active.n++;
      writeFileSync(join(active.dir, `f${String(i).padStart(5, '0')}.jpg`), Buffer.from(data, 'base64'));
      active.stamps.push(metadata.timestamp);
    }
    await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  return {
    async start(name) {
      const dir = join(capDir, name);
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      active = { dir, n: 0, stamps: [], name };
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
    },
    async stop() {
      await cdp.send('Page.stopScreencast').catch(() => {});
      await sleep(150);
      const a = active;
      active = null;
      if (!a) return null;
      const t0 = a.stamps[0] ?? 0;
      const rel = a.stamps.map((s) => +(s - t0).toFixed(4));
      writeFileSync(join(a.dir, 'stamps.json'), JSON.stringify({ name: a.name, frames: a.n, seconds: rel.at(-1) ?? 0, stamps: rel }));
      console.log(`  [cap] ${a.name}: ${a.n} frames, ${(rel.at(-1) ?? 0).toFixed(2)} s`);
      return a;
    },
  };
}

/** Run a wrap action (menu button id). */
export const act = (page, id) => page.evaluate((a) => window.__ff2.wrap.act(a), id);

/** The IWSDK world (via the dev plugin's MCP runtime). */
export const worldExpr = 'window.FRAMEWORK_MCP_RUNTIME.world';

/** Find a system instance by class name inside the page. */
export const systemExpr = (name) => `[...${worldExpr}.systems].find((s) => s.constructor.name === '${name}')`;

/** Import a source module inside the page (same instance the app uses). */
export const mod = (path) => `(await import('${path}'))`;

/** Press-and-hold + punch with the emulated right/left controller: a real
 *  fireball throw through the game's own input path. */
export async function throwBall(page, hand = 'right', { spin = 650, dir = [0, 0.15, -1], power = 0.13 } = {}) {
  await page.evaluate(async ({ hand, spin, dir, power }) => {
    const c = window.IWER_DEVICE.controllers[hand];
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const x0 = c.position.x, y0 = c.position.y, z0 = c.position.z;
    c.setButtonValueImmediate('trigger', 1);
    await sleep(spin);
    // wind back a touch
    for (let i = 0; i < 4; i++) {
      c.position.set(x0 - dir[0] * 0.04 * i, y0 - dir[1] * 0.04 * i, z0 - dir[2] * 0.04 * i);
      await new Promise((r) => requestAnimationFrame(r));
    }
    for (let i = 1; i <= 7; i++) {
      c.position.set(x0 + dir[0] * power * i, y0 + dir[1] * power * i, z0 + dir[2] * power * i);
      await new Promise((r) => requestAnimationFrame(r));
    }
    c.setButtonValueImmediate('trigger', 0);
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => requestAnimationFrame(r));
    // ease the hand back
    for (let i = 7; i >= 0; i--) {
      c.position.set(x0 + dir[0] * power * i * 0.5, y0 + dir[1] * power * i * 0.5, z0 + dir[2] * power * i * 0.5);
      await new Promise((r) => requestAnimationFrame(r));
    }
    c.position.set(x0, y0, z0);
  }, { hand, spin, dir, power });
}

/** Tap a controller button (recall etc). */
export async function tap(page, hand, button = 'trigger', ms = 80) {
  await page.evaluate(async ({ hand, button, ms }) => {
    const c = window.IWER_DEVICE.controllers[hand];
    c.setButtonValueImmediate(button, 1);
    await new Promise((res) => setTimeout(res, ms));
    c.setButtonValueImmediate(button, 0);
  }, { hand, button, ms });
}

/** Keep the controllers idling like real hands (breathing sway). */
export async function idleHands(page, on = true) {
  await page.evaluate((on) => {
    if (window.__idleStop) window.__idleStop();
    if (!on) return;
    let stop = false;
    window.__idleStop = () => { stop = true; };
    const L = window.IWER_DEVICE.controllers.left;
    const R = window.IWER_DEVICE.controllers.right;
    const t0 = performance.now();
    const step = () => {
      if (stop) return;
      const t = (performance.now() - t0) / 1000;
      L.position.set(-0.24 + Math.sin(t * 1.3) * 0.015, 1.15 + Math.sin(t * 1.7) * 0.02, -0.38 + Math.cos(t * 0.9) * 0.015);
      R.position.set(0.24 + Math.cos(t * 1.1) * 0.015, 1.15 + Math.sin(t * 1.9 + 1) * 0.02, -0.38 + Math.sin(t * 0.8) * 0.015);
      requestAnimationFrame(step);
    };
    step();
  }, on);
}
