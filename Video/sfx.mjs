// Synthesised meme SFX, rendered with ffmpeg into Video/sfx/*.wav.
// Nothing here is sampled from anywhere — every hit is a formula.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'sfx');
mkdirSync(out, { recursive: true });

function render(name, filter, seconds) {
  const file = join(out, `${name}.wav`);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', filter, '-t', String(seconds), '-ar', '48000', '-ac', '2', file]);
  console.log('wrote', file);
}

// THE BOOM — a sub thump: sine sweeping 110→38 Hz with a hard decay, plus a click.
render('boom', "aevalsrc='0.9*sin(2*PI*t*(38+72*exp(-t*9)))*exp(-t*3.2) + 0.25*sin(2*PI*t*(180)*exp(-t*20))*exp(-t*40)':s=48000,alimiter=limit=0.95", 1.6);
// BASS DROP — 1.2 s dive from 160 to 28 Hz with a growl.
render('drop', "aevalsrc='0.8*sin(2*PI*t*(28+132*exp(-t*2.2)))*min(1,t*8)*exp(-t*1.4) + 0.2*sin(2*PI*t*(56+264*exp(-t*2.2)))*exp(-t*2.5)':s=48000,alimiter=limit=0.95", 2.2);
// AIRHORN — three detuned saws (approximated by summed harmonics) with vibrato.
render('airhorn', "aevalsrc='(0.35*(sin(2*PI*t*440*(1+0.006*sin(2*PI*t*5.5)))+0.5*sin(2*PI*t*880*(1+0.006*sin(2*PI*t*5.5)))+0.33*sin(2*PI*t*1320*(1+0.006*sin(2*PI*t*5.5)))) + 0.35*(sin(2*PI*t*554)+0.5*sin(2*PI*t*1108)+0.33*sin(2*PI*t*1662)) + 0.3*(sin(2*PI*t*659)+0.5*sin(2*PI*t*1318)))*min(1,t*40)*(1-exp(-(1.1-t)*30))':s=48000,acrusher=bits=6:mix=0.4,alimiter=limit=0.9", 1.1);
// DING — two-tone notification.
render('ding', "aevalsrc='0.6*sin(2*PI*t*1047)*exp(-t*6) + 0.5*sin(2*PI*t*1568)*exp(-t*5)*gte(t,0.12)':s=48000", 0.9);
// RECORD SCRATCH — bandpassed noise with a fast pitch wobble.
render('scratch', "anoisesrc=color=pink:seed=7:amplitude=0.9,bandpass=f=1400:width_type=o:w=1.5,vibrato=f=9:d=0.9,afade=t=out:st=0.35:d=0.25", 0.6);
// WHOOSH — filtered noise swell, for zoom punches.
render('whoosh', "anoisesrc=color=white:seed=3:amplitude=0.7,highpass=f=800,lowpass=f=6000,afade=t=in:st=0:d=0.18,afade=t=out:st=0.18:d=0.22", 0.4);
// GLITCH — square bursts.
render('glitch', "aevalsrc='0.5*sgn(sin(2*PI*t*(220+900*mod(floor(t*40),5))))*lt(mod(t*40,1),0.6)':s=48000,alimiter=limit=0.8", 0.5);
// HIT — short noisy slap for landed fireballs.
render('hit', "anoisesrc=color=brown:seed=11:amplitude=1,lowpass=f=900,afade=t=out:st=0.02:d=0.16,volume=1.6,alimiter=limit=0.95", 0.2);
// CLICK — a dry tick for the fast cuts.
render('click', "aevalsrc='0.5*sin(2*PI*t*2400)*exp(-t*90)':s=48000", 0.08);
// RISER — a 1.9 s noise + sine climb into a drop.
render('riser', "aevalsrc='0.35*sin(2*PI*t*(200+900*t*t))*(t/1.9) + 0.25*sin(2*PI*t*(100+450*t*t))*(t/1.9)':s=48000,alimiter=limit=0.9", 1.9);
console.log('sfx done');
