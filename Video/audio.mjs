// Mix the trailer's audio: the track (with bass-boost windows + fade), the
// synthesised SFX and the game's own announcer/coin samples, all placed by
// the shared timeline.  →  Video/edit/mix.wav
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const { TL } = await import(arg('tl', './edit/timeline.mjs').replace(/^\.\//, './'));
const music = process.env.MUSIC ?? 'C:/Users/alexv/Downloads/Anticipation.m4a';
const out = join(here, 'edit', arg('out', 'mix.wav'));

const SFX = {
  boom: join(here, 'sfx/boom.wav'),
  drop: join(here, 'sfx/drop.wav'),
  airhorn: join(here, 'sfx/airhorn.wav'),
  ding: join(here, 'sfx/ding.wav'),
  scratch: join(here, 'sfx/scratch.wav'),
  whoosh: join(here, 'sfx/whoosh.wav'),
  glitch: join(here, 'sfx/glitch.wav'),
  hit: join(here, 'sfx/hit.wav'),
  click: join(here, 'sfx/click.wav'),
  riser: join(here, 'sfx/riser.wav'),
  boing: join(here, 'sfx/boing.wav'),
  whistle: join(here, 'sfx/whistle.wav'),
  quack: join(here, 'sfx/quack.wav'),
  fart: join(here, 'sfx/fart.wav'),
  three: join(repo, 'src/assets/announcer/3.mp3'),
  two: join(repo, 'src/assets/announcer/2.mp3'),
  one: join(repo, 'src/assets/announcer/1.mp3'),
  fight: join(repo, 'src/assets/announcer/fight.mp3'),
  cash: join(repo, 'src/assets/currency/cash.mp3'),
  ignite: join(repo, 'src/assets/landing/landing1.mp3'),
};

const inputs = ['-i', music];
const chains = [];
const mixIns = [];
// music: two chains gated by time — clean and boosted (earrape windows)
const boostExpr = TL.boosts.length ? TL.boosts.map(([a, b]) => `between(t,${a},${b})`).join('+') : '0';
const fadeStart = TL.musicFade?.[0] ?? TL.DUR - 2.5;
const fadeDur = TL.musicFade?.[1] ?? 2.5;
const musicOffset = TL.musicOffset ?? 0;
chains.push(`[0:a]atrim=start=${musicOffset}:end=${musicOffset + TL.DUR},asetpts=PTS-STARTPTS,aresample=48000,volume=${TL.musicGain ?? 1.0},afade=t=out:st=${fadeStart}:d=${fadeDur},asplit=2[mc][mb]`);
chains.push(`[mc]volume='if(${boostExpr},0,1)':eval=frame[mclean]`);
chains.push(`[mb]volume='if(${boostExpr},1,0)':eval=frame,bass=g=16:f=95,acrusher=bits=7:mix=0.35,volume=3.2,alimiter=limit=0.98:level=false[mboost]`);
mixIns.push('[mclean]', '[mboost]');
// every SFX event
let idx = 1;
for (const ev of TL.audio) {
  const file = SFX[ev.sfx];
  if (!file) { console.warn('unknown sfx', ev.sfx); continue; }
  inputs.push('-i', file);
  const ms = Math.round(ev.t * 1000);
  const extra = ev.pitch ? `,asetrate=48000*${ev.pitch},aresample=48000` : '';
  chains.push(`[${idx}:a]aresample=48000,aformat=channel_layouts=stereo${extra},volume=${ev.vol ?? 1},adelay=${ms}|${ms}[s${idx}]`);
  mixIns.push(`[s${idx}]`);
  idx++;
}
chains.push(`${mixIns.join('')}amix=inputs=${mixIns.length}:duration=first:normalize=0:dropout_transition=0,alimiter=limit=0.97:level=false[out]`);
const filter = chains.join(';');
const args = ['-hide_banner', '-loglevel', 'warning', '-y', ...inputs, '-filter_complex', filter, '-map', '[out]', '-t', String(TL.DUR), '-ar', '48000', '-ac', '2', out];
execFileSync('ffmpeg', args, { stdio: 'inherit' });
console.log('wrote', out, `(${TL.audio.length} sfx events, ${TL.boosts.length} boost windows)`);
