/**
 * RAVE RAID — entry point.
 *
 * Boots an IWSDK World as a FULL VR (immersive-VR) session. Nothing here is
 * halfway anymore: the foyer is a platform in the void, the club is a sealed
 * hall, and the set plays inside the void environment — your real floor is
 * still the platform you dodge on (roomscale reference space keeps y = 0 at
 * your actual floor), but your room itself is never shown.
 *
 * `npm run dev` and open the page: a headset offers ENTER THE RAVE; on
 * desktop the IWSDK dev plugin provides a WebXR emulator (WASD + mouse).
 * For online rooms also run `npm run server`.
 */

import { launchXR, SessionMode, World } from '@iwsdk/core';
import { Color } from 'three';
import { ensureAudio } from './audio/sfx.js';
import { VOID_BG } from './arena/voidkit.js';
import { ArcadeSystem } from './systems/ArcadeSystem.js';
import { ArenaSystem } from './systems/ArenaSystem.js';
import { AvatarSystem } from './systems/AvatarSystem.js';
import { ChoreoSystem } from './systems/ChoreoSystem.js';
import { ClubBallSystem } from './systems/ClubBallSystem.js';
import { ClubMirrorSystem } from './systems/ClubMirrorSystem.js';
import { ClubPropsSystem } from './systems/ClubPropsSystem.js';
import { ClubSocialSystem } from './systems/ClubSocialSystem.js';
import { ClubSystem } from './systems/ClubSystem.js';
import { ClubTeleportSystem } from './systems/ClubTeleportSystem.js';
import { CourseFrameSystem } from './systems/CourseFrameSystem.js';
import { CoursePlatformSystem } from './systems/CoursePlatformSystem.js';
import { CourseSystem } from './systems/CourseSystem.js';
import { CourseVoidSystem } from './systems/CourseVoidSystem.js';
import { CourseRidersSystem } from './systems/CourseRidersSystem.js';
import { CourseWayfindSystem } from './systems/CourseWayfindSystem.js';
import { DiscoSystem } from './systems/DiscoSystem.js';
import { GoopliathSystem } from './systems/GoopliathSystem.js';
import { HudSystem } from './systems/HudSystem.js';
import { IntroSystem, introView } from './systems/IntroSystem.js';
import { McSystem } from './systems/McSystem.js';
import { MenuSystem } from './systems/MenuSystem.js';
import { MusicSystem } from './systems/MusicSystem.js';
import { NetworkSystem } from './systems/NetworkSystem.js';
import { PlayerSystem } from './systems/PlayerSystem.js';
import { RankSystem } from './systems/RankSystem.js';
import { installRaveDevHook } from './devHook.js';

const container = document.getElementById('scene-container') as HTMLDivElement;
const enterButton = document.getElementById('enter-vr') as HTMLButtonElement | null;

/** The created world, for the debug hook below (set once boot resolves). */
let worldRef: World | null = null;

enterButton?.setAttribute('disabled', '');

function hideLanding(): void {
  document.body.classList.add('app-entered');
  // House lights down: the title card plays on the inside of the headset,
  // cued by the same moment the web page gets out of the way.
  introView.begin?.();
}

function showLanding(): void {
  document.body.classList.remove('app-entered');
  enterButton?.removeAttribute('disabled');
}

World.create(container, {
  // The landing button calls IWSDK's explicit WebXR launcher from the user's
  // tap. Quest Browser needs that direct requestSession gesture path.
  xr: {
    sessionMode: SessionMode.ImmersiveVR,
    offer: 'none',
  },
  // A stationary dodge game: you never leave your platform, and nothing is
  // grabbed — your body IS the controller. (The club's teleport is our own.)
  features: {
    grabbing: false,
    locomotion: false,
    spatialUI: false,
  },
  render: {
    // The void is the backdrop, everywhere and always.
    defaultLighting: false,
    far: 160,
    camera: { position: [0, 1.65, 0] },
  },
}).then(async (world) => {
  worldRef = world;
  // FULL VR: an opaque backdrop behind every place. The club's walls stand
  // in front of it; the foyer and the set live inside it.
  world.scene.background = new Color(VOID_BG);
  // Order matters lightly: player pose first, then the floor, then everything
  // that reads both. Music owns the clock; choreo owns the judgement.
  world.registerSystem(PlayerSystem);
  world.registerSystem(ArenaSystem);
  // The venue's places (foyer void + the club), teleport-only movement,
  // the social floor (room-mates, voice, mute/block), and the raid-calling
  // ball. The teleport system runs before the network pumps so the rig is
  // already re-planted at the spawn on the frame a set books the floor.
  world.registerSystem(ClubSystem);
  world.registerSystem(ClubTeleportSystem);
  // THE WEST DOOR and what's behind it. Registered AFTER the teleport so
  // that on the frame the crossing happens the course's frame of reference
  // has the last word on the rig — the teleport drops every club offset on
  // its way out, and the circuit plants the rig where the pad is.
  world.registerSystem(CourseSystem);
  world.registerSystem(CoursePlatformSystem);
  world.registerSystem(CourseFrameSystem);
  world.registerSystem(CourseWayfindSystem);
  world.registerSystem(CourseVoidSystem);
  world.registerSystem(CourseRidersSystem);
  world.registerSystem(ClubSocialSystem);
  world.registerSystem(ClubMirrorSystem);
  world.registerSystem(ClubBallSystem);
  world.registerSystem(ArcadeSystem);
  world.registerSystem(ClubPropsSystem);
  world.registerSystem(MusicSystem);
  world.registerSystem(ChoreoSystem);
  world.registerSystem(GoopliathSystem);
  world.registerSystem(McSystem);
  world.registerSystem(AvatarSystem);
  world.registerSystem(RankSystem);
  world.registerSystem(DiscoSystem);
  world.registerSystem(HudSystem);
  world.registerSystem(MenuSystem);
  world.registerSystem(NetworkSystem);
  // Last, so its blackout is built after everything it covers.
  world.registerSystem(IntroSystem);

  const xrSupported =
    (await navigator.xr?.isSessionSupported(SessionMode.ImmersiveVR).catch(() => false)) === true;

  if (enterButton && xrSupported) {
    enterButton.removeAttribute('disabled');
    enterButton.addEventListener('click', () => {
      enterButton.setAttribute('disabled', '');
      ensureAudio(); // unlock the AudioContext inside the tap gesture
      launchXR(world, { sessionMode: SessionMode.ImmersiveVR });

      const watchForSession = (): void => {
        if (world.session) {
          hideLanding();
          world.session.addEventListener('end', showLanding, { once: true });
          return;
        }
        if (!document.body.classList.contains('app-entered')) {
          requestAnimationFrame(watchForSession);
        }
      };
      requestAnimationFrame(watchForSession);
      window.setTimeout(() => {
        if (!world.session) enterButton.removeAttribute('disabled');
      }, 4000);
    });
  } else if (enterButton) {
    enterButton.textContent = 'XR unavailable';
  }

  // eslint-disable-next-line no-console
  console.info('[RAVE RAID] World ready — the floor is set, the goop is warm.');
});

installRaveDevHook(() => worldRef);
