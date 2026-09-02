#!/usr/bin/env node
/**
 * THE WRAP, headless.
 *
 *   npm run dev              # terminal 1
 *   node tools/wrap-check.mjs [--shots]
 *
 * Boots the game in headless Chromium (the IWSDK dev plugin's IWER
 * emulator provides WebXR), enters the arena, and drives the TABBED wrap
 * (MENUS 2) through its dev hook (window.__ff2.wrap): the center slab's
 * FIGHT · ARCADE · CLUB tabs and FIGHT's drill-down flows, the TOWN wing's
 * TOWN · LADDER · NEWS (the leaderboard and the paper live there now), the
 * YOU wing's YOU · SETTINGS, and THE PROFILE chip + card above the right
 * wing. --shots saves each face's canvas as a PNG beside this script.
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

async function enter() {
  await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => page.goto(base));
  await page.waitForTimeout(1200);
  await page.click('#enter-vr');
  await page.waitForFunction(() => document.body.classList.contains('app-entered'), { timeout: 20000 });
  await page.waitForTimeout(2200);
}
await enter();

const results = [];
const check = (name, ok, detail) => {
  results.push(ok);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};
const save = (name, data) => {
  if (!shots || !data) return;
  const file = join(here, `wrap-${name}.png`);
  writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
  console.log(`  wrote ${file}`);
};

const hook = await page.evaluate(() => !!window.__ff2?.wrap);
check('the wrap dev hook is up', hook);
if (!hook) {
  await browser.close();
  process.exit(1);
}

const wrap = (expr) => page.evaluate(`window.__ff2.wrap.${expr}`);
const tabsOf = (ids) => ids.filter((b) => b.startsWith('wrap:tab-'));
const notTabs = (ids) => ids.filter((b) => !b.startsWith('wrap:tab-'));
const has = (ids, ...want) => want.every((w) => ids.includes(w));

console.log('\n=== the strips: tabs across the top of every panel ===');
const tutorialDone = await page.evaluate(() => localStorage.getItem('ff-tutorial-done') === '1');
let slab = await wrap(`buttons('train')`);
check('the slab wears FIGHT · ARCADE · CLUB', has(slab, 'wrap:tab-fight', 'wrap:tab-arcade', 'wrap:tab-club'), tabsOf(slab).join(','));
let town = await wrap(`buttons('duel')`);
check('the TOWN wing wears TOWN · LADDER · NEWS', has(town, 'wrap:tab-town', 'wrap:tab-ladder', 'wrap:tab-news'), tabsOf(town).join(','));
let you = await wrap(`buttons('info')`);
check('the YOU wing wears YOU · SETTINGS', has(you, 'wrap:tab-you', 'wrap:tab-settings'), tabsOf(you).join(','));
if (!tutorialDone) {
  check('a fresh save leads with the tutorial', slab.includes('start-tutorial'), slab.join(','));
  const live = notTabs(await wrap(`live('train')`));
  check('and ONLY the tutorial answers on the slab', live.length === 1 && live[0] === 'start-tutorial', live.join(','));
  const liveTabs = tabsOf(await wrap(`live('train')`));
  check('ARCADE and CLUB tabs are sealed too', !liveTabs.includes('wrap:tab-arcade') && !liveTabs.includes('wrap:tab-club'), liveTabs.join(','));
  const liveTown = tabsOf(await wrap(`live('duel')`));
  check('the LADDER is sealed, the paper is not', !liveTown.includes('wrap:tab-ladder') && liveTown.includes('wrap:tab-news'), liveTown.join(','));
  // Unseal for the rest of the walk.
  await page.evaluate(() => localStorage.setItem('ff-tutorial-done', '1'));
  await enter();
  slab = await wrap(`buttons('train')`);
}

console.log('\n=== the slab: FIGHT · ARCADE · CLUB ===');
let nav = await wrap(`nav()`);
check('the slab opens on FIGHT', nav.center === 'fight' && !nav.club, JSON.stringify(nav));
check('FIGHT: modes + the demoted ONLY BOTS, no BACK', has(slab, 'quick-match', 'ranked-match', 'private-open', 'arcade-2v2', 'arcade-ffa', 'toggle-onlybots') && !slab.includes('wrap:back'), notTabs(slab).join(','));
save('fight', await wrap(`snap('train')`));
await wrap(`act('wrap:tab-arcade')`);
slab = await wrap(`buttons('train')`);
nav = await wrap(`nav()`);
check('ARCADE tab: modes + the demoted SHOOT BACK', nav.center === 'arcade' && has(slab, 'start-tutorial', 'open-campaign', 'open-raid', 'start-training', 'toggle-shootback'), notTabs(slab).join(','));
check('ARCADE tab: the door to RAVE RAID', slab.includes('open-rave'), String(slab.includes('open-rave')));
save('arcade', await wrap(`snap('train')`));
await wrap(`act('wrap:tab-club')`);
slab = await wrap(`buttons('train')`);
nav = await wrap(`nav()`);
check('CLUB tab: the region doors on the slab', nav.club && notTabs(slab).every((b) => b.startsWith('pub-go-')) && notTabs(slab).length > 0, notTabs(slab).join(','));
save('club', await wrap(`snap('train')`));
await wrap(`act('wrap:tab-fight')`);
nav = await wrap(`nav()`);
check('FIGHT tab again folds the club picker', nav.center === 'fight' && !nav.club, JSON.stringify(nav));

console.log('\n=== through FIGHT: the flows still drill in and BACK out ===');
await wrap(`act('private-open')`);
let face = await wrap(`buttons('train')`);
check('PRIVATE face on the slab, tabs still up', has(face, 'private-mode-1v1', 'private-create', 'private-enter', 'wrap:tab-fight'), notTabs(face).join(','));
await wrap(`act('private-enter')`);
face = await wrap(`buttons('train')`);
check('keypad face on the slab', has(face, 'kp-5', 'kp-join', 'kp-del'), notTabs(face).join(','));
save('keypad', await wrap(`snap('train')`));
await wrap(`act('private-back')`);
face = await wrap(`buttons('train')`);
check('BACK lands on the FIGHT root', face.includes('quick-match') || face.includes('cancel-queue'), notTabs(face).join(','));

console.log('\n=== the TOWN wing: TOWN · LADDER · NEWS ===');
town = await wrap(`buttons('duel')`);
check('TOWN: the live chips, nothing pressable', has(town, 'town-queue', 'town-raids', 'town-club') && notTabs(await wrap(`live('duel')`)).length === 0, notTabs(town).join(','));
save('town', await wrap(`snap('duel')`));
await wrap(`act('wrap:tab-ladder')`);
town = await wrap(`buttons('duel')`);
nav = await wrap(`nav()`);
check('LADDER: opens on BATTLE › 1V1 with its sub-boards', nav.town === 'ladder' && has(town, 'lb-battle', 'lb-xp', 'lb-arcade', 'lb-ranked', 'lb-duo', 'lb-ffa'), notTabs(town).join(','));
save('ladder', await wrap(`snap('duel')`));
await wrap(`act('lb-arcade')`);
town = await wrap(`buttons('duel')`);
check('LADDER › ARCADE: aim + the run boards', has(town, 'lb-training', 'lb-gauntlet', 'lb-raid', 'lb-goopliath') && !town.includes('lb-ranked'), notTabs(town).join(','));
await wrap(`act('lb-xp')`);
town = await wrap(`buttons('duel')`);
check('LADDER › XP: no sub-row', !town.includes('lb-ranked') && !town.includes('lb-training'), notTabs(town).join(','));
await wrap(`act('wrap:tab-town')`);

// THE GAZETTE (net/gazette.ts + menu.ts): inject an edition with the voice's
// sections — a WANTED poster, the NOTICE, the WEATHER — open the paper (the
// NEWS tab) and snap the wing; it must lay out and render without a page error.
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
  nav = await wrap(`nav()`);
  const snap = await page.evaluate(() => window.__ff2.gazette.snap());
  const snap2 = await page.evaluate(() => { window.__ff2.gazette.scroll(900); return window.__ff2.gazette.snap(); });
  await page.evaluate(() => window.__ff2.gazette.close());
  const after = await wrap(`nav()`);
  check("GAZETTE: opening the paper lands on the NEWS tab; the edition lays out and renders", nav.town === 'news' && snap.startsWith('data:image/png') && snap.length > 20000 && errors.length === before, `${nav.town} · ${snap.length} bytes`);
  check('GAZETTE: closing the paper returns to TOWN', after.town === 'town', after.town);
  save('news', snap);
  save('news-2', snap2);
}

console.log('\n=== the YOU wing: YOU · SETTINGS ===');
you = await wrap(`buttons('info')`);
check('YOU leads with the paint bay + body; rename moved to the card', has(you, 'open-paintbay', 'open-custom') && !you.includes('rename') && !you.includes('open-pub'), notTabs(you).join(','));
save('you', await wrap(`snap('info')`));
await wrap(`act('wrap:tab-settings')`);
you = await wrap(`buttons('info')`);
nav = await wrap(`nav()`);
check('SETTINGS: tracks, breakers, report, credits', nav.you === 'settings' && has(you, 'sfx-vol', 'music-vol', 'toggle-mute', 'toggle-voice', 'toggle-hide-paint', 'settings-report', 'settings-credits'), notTabs(you).join(','));
save('settings', await wrap(`snap('info')`));
await wrap(`act('settings-credits')`);
you = await wrap(`buttons('info')`);
check('CREDITS is a sub-face with BACK', you.includes('credits-back') && !you.includes('sfx-vol'), notTabs(you).join(','));
await wrap(`act('credits-back')`);
await wrap(`act('wrap:tab-you')`);
you = await wrap(`buttons('info')`);
nav = await wrap(`nav()`);
check('YOU tab again', nav.you === 'you' && you.includes('open-paintbay'), nav.you);

console.log('\n=== WHO HEARS WHOM (net/voiceRules.ts) ===');
{
  const v = await page.evaluate(() => {
    const voice = window.__ff2.voice;
    localStorage.setItem('ff-voice', '1');
    const before = { ctx: voice.context(), allowed: voice.allowed(), hear: voice.hear() };
    voice.ranked(true);
    const ranked = { ctx: voice.context(), allowed: voice.allowed(), hear: voice.hear() };
    voice.ranked(false);
    const table = Object.fromEntries(Object.entries(voice.rules).map(([k, r]) => [k, `${r.speak ? 'mic' : 'no mic'}/${r.hear}`]));
    return { before, ranked, table };
  });
  check('a duel opens mics and ears', v.before.ctx === 'duel' && v.before.allowed && v.before.hear, JSON.stringify(v.before));
  check('RANKED is silence: no mic, no ears', v.ranked.ctx === 'ranked' && !v.ranked.allowed && !v.ranked.hear, JSON.stringify(v.ranked));
  check('the table: club hears the room, the audience hears everyone, ranked nobody', v.table.club === 'mic/room' && v.table.audience === 'mic/everyone' && v.table.ranked === 'no mic/nobody', JSON.stringify(v.table));
}

console.log('\n=== THE AUDIENCE: the terrace, the bodies, the roar ===');
{
  const a = (expr) => page.evaluate(`window.__ff2.audience.${expr}`);
  // A bout puts the desert on the FLATS, whose flanks grew terraces.
  await a(`watch(true, 4)`);
  await page.waitForTimeout(500);
  const stands = await a(`stands()`);
  const where = await a(`where()`);
  const roster = await a(`roster()`);
  const padHidden = !(await a(`pad()`));
  check('the flats offer standing room', stands > 0, String(stands));
  // Out on a flank, standing on a riser rather than on the sand (the front
  // tier's plate sits ~0.5 m over whatever the dune under it is doing).
  check('a watcher is planted on a stand, off the ground', !!where && Math.abs(where.x) > 5 && where.y > 0.25, JSON.stringify(where));
  check('and every fighter is on show (me, then the whole ring)', roster[0] === -1 && roster.length === 3 && roster[1] === 0 && roster[2] === 1, JSON.stringify(roster));
  check("the watcher's own platform is gone", padHidden === true, String(padHidden));

  // Two more watchers on the wire: bodies at the rail, and their hands
  // aggregate into the room's roar.
  await a(`wire(5, ${where?.x ?? 0}, ${where?.y ?? 1}, ${(where?.z ?? 0) + 1}, 1)`);
  await a(`wire(6, ${where?.x ?? 0}, ${where?.y ?? 1}, ${(where?.z ?? 0) + 2}, 0)`);
  await page.waitForTimeout(400);
  const bodies = await a(`bodies()`);
  const roar = await a(`roar()`);
  const inScene = await a(`inScene()`);
  check('watchers on the wire grow bodies at the rail', bodies === 2 && inScene === 2, JSON.stringify({ bodies, inScene }));
  check('half the terrace with its hands up is half a roar', roar.room > 0.2 && roar.room < 0.5, JSON.stringify(roar));

  // The rule that makes the crowd a crowd.
  const ctx = await page.evaluate(() => window.__ff2.voice.context());
  check('a watcher is in the AUDIENCE, hearing everyone', ctx === 'audience', ctx);

  await a(`clear()`);
  await a(`watch(false)`);
  await page.waitForTimeout(400);
  const after = await a(`where()`);
  const padBack = await a(`pad()`);
  check('standing down hands the ground back', after === null && padBack, JSON.stringify({ after, padBack }));
}

console.log('\n=== THE PROFILE: the chip and its card ===');
const chip = await wrap(`buttons('profile')`);
check('the chip is one pressable ghost', chip.length === 1 && chip[0] === 'profile-toggle', chip.join(','));
const cardHidden = await wrap(`visible('profilecard')`);
await wrap(`act('profile-toggle')`);
await page.waitForTimeout(300); // MenuSystem shows the card on the next frame
const cardShown = await wrap(`visible('profilecard')`);
const card = await wrap(`buttons('profilecard')`);
check('tapping the chip drops the card: rename · write note · close', !cardHidden && cardShown && has(card, 'rename', 'edit-note', 'profile-close'), `${cardHidden}→${cardShown} · ${card.join(',')}`);
save('profile', await wrap(`snap('profile')`));
save('profilecard', await wrap(`snap('profilecard')`));
await wrap(`act('profile-close')`);
await page.waitForTimeout(300);
check('CLOSE folds it', !(await wrap(`visible('profilecard')`)));

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

check('no page errors along the way', errors.length === 0, errors.join(' | '));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad === 0 ? 'ALL PASS' : `${bad} FAILURE(S)`}`);
await browser.close();
process.exit(bad === 0 ? 0 : 1);
