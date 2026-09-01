#!/usr/bin/env node
/**
 * THE WRAP, headless.
 *
 *   npm run dev              # terminal 1
 *   node tools/wrap-check.mjs [--shots]
 *
 * Boots the game in headless Chromium (the IWSDK dev plugin's IWER
 * emulator provides WebXR), enters the arena, and drives the SIMPLIFIED
 * wrap through its dev hook (window.__ff2.wrap): the three-door root,
 * the FIGHT door's flows (private → keypad → back), the ARCADE door, the
 * buttonless TOWN board and the YOU wing. --shots saves each panel's
 * canvas as a PNG beside this script.
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const shots = process.argv.includes('--shots');
const here = dirname(fileURLToPath(import.meta.url));

async function launch() {
  const args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--ignore-certificate-errors'];
  try {
    return await chromium.launch({ args });
  } catch {
    return chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args });
  }
}

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errors = [];
page.on('pageerror', (e) => {
  errors.push(e.message);
  console.log(`[pageerror] ${e.message}`);
});

await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => page.goto(base));
await page.waitForTimeout(1200);
await page.click('#enter-vr');
await page.waitForFunction(() => document.body.classList.contains('app-entered'), { timeout: 20000 });
await page.waitForTimeout(2200);

const results = [];
const check = (name, ok, detail) => {
  results.push(ok);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const hook = await page.evaluate(() => !!window.__ff2?.wrap);
check('the wrap dev hook is up', hook);
if (!hook) {
  await browser.close();
  process.exit(1);
}

const wrap = (expr) => page.evaluate(`window.__ff2.wrap.${expr}`);

console.log('\n=== the root: three doors, nothing more ===');
const tutorialDone = await page.evaluate(() => localStorage.getItem('ff-tutorial-done') === '1');
let root = await wrap(`buttons('train')`);
if (!tutorialDone) {
  check('a fresh save leads with the tutorial', root.includes('start-tutorial'), root.join(','));
  const live = await wrap(`live('train')`);
  check('and ONLY the tutorial answers', live.length === 1 && live[0] === 'start-tutorial', live.join(','));
  // Unseal for the rest of the walk.
  await page.evaluate(() => localStorage.setItem('ff-tutorial-done', '1'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.click('#enter-vr');
  await page.waitForFunction(() => document.body.classList.contains('app-entered'), { timeout: 20000 });
  await page.waitForTimeout(2200);
  root = await wrap(`buttons('train')`);
}
check('the root offers FIGHT · ARCADE · CLUB', root.includes('wrap:fight') && root.includes('wrap:arcade') && root.includes('open-pub'), root.join(','));
check('and nothing else is presented', root.length === 3, String(root.length));

console.log('\n=== the wings stay quiet ===');
const town = await wrap(`live('duel')`);
check('THE TOWN board has no buttons at all', town.length === 0, town.join(','));
const you = await wrap(`buttons('info')`);
check('YOU leads with the paint bay + body, no club door', you.includes('open-paintbay') && you.includes('open-custom') && you.includes('rename') && !you.includes('open-pub'), you.join(','));

// THE GAZETTE (net/gazette.ts + menu.ts): inject an edition with the voice's
// sections — a WANTED poster, the NOTICE, the WEATHER — open the paper and
// snap the page; it must lay out and render without a page error.
{
  const before = errors.length;
  await page.evaluate(() => {
    window.__ff2.gazette.inject({
      headline: 'VOLTAIRE UP NINE RUNGS; SOMEBODY CHECK THE LADDER',
      subhead: 'A pair fight, a brawl, and a coat of OXBLOOD this office did not authorise.',
      body: 'VOLTAIRE rose nine rungs on the roll overnight, which is not a climb so much as a jailbreak. Eleven engagements, most of them duels.\n\nOut at the boneyard a squad put down JUGGERNAUT in eight minutes on the county watch. They came back through the trailhead at dusk making the noise they make.\n\nThe sign still points the wrong way. My knee has been clicking since the weather turned; the doctor says it is the weather.',
      mood: 'AGGRIEVED',
      wanted: { name: 'VOLTAIRE', crime: 'Excessive winning. Also the paint.', reward: '200 bolt-dollars' },
      notice: 'The boneyard is closed to picnickers until GOLIATH stops getting back up.',
      weather: 'Dusk. It has been dusk for some time. Expect dusk.',
    });
    window.__ff2.gazette.open();
  });
  await page.waitForTimeout(400);
  const snap = await page.evaluate(() => window.__ff2.gazette.snap());
  // …and the fold: scroll to the poster, the notice and the weather.
  const snap2 = await page.evaluate(() => { window.__ff2.gazette.scroll(900); return window.__ff2.gazette.snap(); });
  await page.evaluate(() => window.__ff2.gazette.close());
  check('GAZETTE: an edition with the voice\'s sections lays out and renders', snap.startsWith('data:image/png') && snap.length > 20000 && errors.length === before, `${snap.length} bytes`);
  if (shots && snap) {
    const file = join(here, 'wrap-gazette.png');
    writeFileSync(file, Buffer.from(snap.split(',')[1], 'base64'));
    console.log(`  wrote ${file}`);
    const file2 = join(here, 'wrap-gazette-2.png');
    writeFileSync(file2, Buffer.from(snap2.split(',')[1], 'base64'));
    console.log(`  wrote ${file2}`);
  }
}

// GEAR (avatar/gear.ts): a dev equip dresses the podium's blank in the piece
// — head + body slots at once — and the wire form re-validates junk away.
{
  const before = await page.evaluate(() => window.__ff2.podium?.gear?.() ?? null);
  await page.evaluate(() => {
    window.__ff2.gear.equip('crest');
    window.__ff2.gear.equip('pauldrons');
  });
  await page.waitForTimeout(400); // applyOwnSkins dresses on the next frame
  const worn = await page.evaluate(() => window.__ff2.podium.gear());
  const wire = await page.evaluate(() => ({
    packed: window.__ff2.gear.pack(),
    junk: window.__ff2.gear.clean('nonsense,crest,horns,,pauldrons'),
    oversized: window.__ff2.gear.clean('crest,' + 'x'.repeat(200)),
  }));
  await page.evaluate(() => {
    window.__ff2.gear.clear('head');
    window.__ff2.gear.clear('body');
  });
  check('GEAR: the podium wears what you equip (crest + pauldrons)', Array.isArray(worn) && worn.includes('crest') && worn.includes('pauldrons') && (before?.length ?? 0) === 0, JSON.stringify({ before, worn }));
  check('GEAR: the wire packs slot-ordered and drops junk / a second head', wire.packed === 'crest,pauldrons' && wire.junk.join(',') === 'crest,pauldrons', JSON.stringify(wire));
  check('GEAR: an oversized wire string is refused whole (bare)', wire.oversized.length === 0, JSON.stringify(wire.oversized));
}

console.log('\n=== through the FIGHT door ===');
await wrap(`act('wrap:fight')`);
let face = await wrap(`buttons('train')`);
check('FIGHT: modes + the demoted ONLY BOTS + back', ['quick-match', 'ranked-match', 'private-open', 'arcade-2v2', 'arcade-ffa', 'toggle-onlybots', 'wrap:back'].every((b) => face.includes(b)), face.join(','));
await wrap(`act('private-open')`);
face = await wrap(`buttons('train')`);
check('PRIVATE face on the slab', face.includes('private-mode-1v1') && face.includes('private-create') && face.includes('private-enter'), face.join(','));
await wrap(`act('private-enter')`);
face = await wrap(`buttons('train')`);
check('keypad face on the slab', face.includes('kp-5') && face.includes('kp-join') && face.includes('kp-del'), face.join(','));
await wrap(`act('private-back')`);
face = await wrap(`buttons('train')`);
check('BACK lands on the FIGHT root', face.includes('quick-match') || face.includes('cancel-queue'), face.join(','));
await wrap(`act('wrap:back')`);
face = await wrap(`buttons('train')`);
check('BACK again lands on the three doors', face.includes('wrap:fight') && face.length === 3, face.join(','));

console.log('\n=== through the ARCADE door ===');
await wrap(`act('wrap:arcade')`);
face = await wrap(`buttons('train')`);
check('ARCADE: modes + the demoted SHOOT BACK + back', ['start-tutorial', 'open-campaign', 'open-raid', 'start-training', 'toggle-shootback', 'wrap:back'].every((b) => face.includes(b)), face.join(','));
await wrap(`act('wrap:back')`);

if (shots) {
  console.log('\n=== saving canvases ===');
  for (const id of ['train', 'duel', 'info']) {
    const data = await wrap(`snap('${id}')`);
    const file = join(here, `wrap-${id}.png`);
    writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
    console.log(`  wrote ${file}`);
  }
}

check('no page errors along the way', errors.length === 0, errors.join(' | '));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad === 0 ? 'ALL PASS' : `${bad} FAILURE(S)`}`);
await browser.close();
process.exit(bad === 0 ? 0 : 1);
