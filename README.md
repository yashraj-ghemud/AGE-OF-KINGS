<p align="center">
  <img src="./.github/readme-assets/playground.gif" alt="Age of Kings" width="100%" />
</p>

<h1 align="center">AGE OF KINGS — <i>The Endless Eclipse</i></h1>

<p align="center"><strong>A cinematic, story-driven, real-time 3D war saga for the browser.</strong><br/>
<strong>Developed by Yashraj Ghemud</strong><br/>
React 18 · React Three Fiber · three.js · Web Audio · no downloaded assets: every model, texture, cinematic and note of music is generated at runtime.</p>

> *Before there were kings, there was the Sun. Then your brother traded it for a crown of shadow.*

The full design (story bible, shot-by-shot cinematic scripts, gameplay systems, architecture) is in
**[`docs/REMASTER_PLAN.md`](docs/REMASTER_PLAN.md)**. It was written before any remaster code.

---

## The remaster at a glance

| | Before | Now |
|---|---|---|
| **Intro** | Icons fading in on a loading screen | An **80-second real-time cinematic** in 11 scripted shots: dawn over Suryagarh, the Sun Crown, a total eclipse, Kaalrath shattering the crown in slow motion, seven comet shards, the Rakshas horde, the dragon egg, the Last King struck by lightning, and a trailer-style title slam |
| **Website** | A title and a button | The **Gate** ember ritual → the intro → a **live 3D menu**, the same world orbiting under the eclipse → an illuminated **War Map** → typewriter **briefings** → **The Chronicle** codex → **Settings** |
| **Story** | 6 one-line nodes | A full saga: Vikram, Kaalrath, Devdutt, Suparna, Aruna the Sun-Dragon. Every mechanic has a reason to exist in the story |
| **World** | Flat green plane | Procedural 2.8 km terrain with plateaus, roads, scorched earth, a mountain ring, forests and wind-swept grass. A shader sky with a **real eclipse**: moon disc, animated corona, diamond-ring rim, stars |
| **Armies** | One React component per soldier (O(n²)) | **One simulation loop**, a spatial hash, and instanced rendering: hundreds of soldiers in ~20 draw calls, at ~0.1 ms of simulation per frame |
| **Physics** | Units slid through walls | Momentum, knockback, ragdoll-tumbling deaths, crowd separation, **ballistic arrows** that stick where they land, castle collision with gate and stair **navigation** |
| **Audio** | A few blips | A **procedural score**: heartbeat, taiko, trailer braams, choir pads, and raga-Bhairav santoor plucks cued to the cinematic. Adaptive battle drums, spatial SFX |
| **Ending** | "Victory!" | ***Dawn***: the shards return, the crown reforms, Aruna wakes and burns the eclipse away, sunrise over the royal host, credits |

## The story in one breath

Kaalrath, passed-over elder brother of King **Vikram**, made a pact with the **Rakshas** of the Ashen Deep and shattered the
**Sun Crown**. Its shards fell across the land, traitor lords rose to claim them, and the moon locked over the sun:
**the Endless Eclipse**. Reclaim the shards, lord by lord, and push the eclipse back until dawn returns.

**How the story drives the mechanics:**
- **Traitor lords** carry crown shards. Killing one triggers a slow-motion **kill-cam**, and the shard flies to you.
- As shards return, the **sky brightens**: the lighting is your campaign progress, from crimson night to amber twilight to sunrise.
- When a lord falls, his **men kneel and swear fealty** (they switch to your colours) and his **Rakshas crumble to ash**.
- Kaalrath needs the king **alive**. Fall in battle and you're **caged, carried and jailed** atop an enemy keep while a
  Blood-Moon timer runs. Blow the war-horn or call a dragon.
- **Ember** (sun-fire freed from the fallen) buys soldiers and the Minister's host, and wakes **ember-kin dragons** you can ride.

## Campaign

`I Ashes of Suryagarh` → choose **II The Burning Plains** (invasion) · **II Wings of the East** (alliance: eagles and a dragon) ·
**II The Siege of Suryagarh** (defense against war-horn waves) → **III The Ember Roads** → **IV The Obsidian Citadel**, where
Kaalrath fights with shadow waves, Rakshas rifts and an eclipse phase at half health.

## Controls

| Input | Action |
|---|---|
| Mouse / WASD | Look / ride (the horse has momentum) |
| Shift · Space | Gallop (stamina) · leap |
| LMB · RMB | Attack (3-hit sword combo, spear throw, hold-to-draw bow) · aim |
| 1 2 3 | Sword · Spear · Bow |
| Q · E · R | War Cry · Sun Charge · Solar Slam |
| Z · X · C | Army order: Attack · Guard · Hold |
| F · G | Rally point · recruit (15 ember) |
| B / Alt · O · P | War-horn host (60) · Ember Rite dragon (120) · mount/dismount dragon |
| V · Wheel · H · Esc | First/third person · zoom · help · pause |

The intro can be skipped by **holding Space or the mouse button**.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # type-check + production build
npm run simtest      # headless soak test: every chapter played by an autopilot, checks for crashes/NaNs
npm run deploy       # Cloudflare Workers (wrangler)
```

**Deep links for testing:** `?screen=intro|menu|map|briefing|chronicle|settings|ending|game`, `?chapter=<id>`,
`?t=<seconds>` (start a cinematic at a timestamp), `&freeze=1` (hold that frame), `&nointro=1`, `&near=1`, `&demo=1` (battle autopilot).

**Quality presets** (Settings): *Cinematic* (MSAA, 4K shadows, dense grass), *Balanced*, *Performance* (no post-FX or shadows; the default on touch devices).

## Architecture

```
src/
  App.tsx              screen router: gate → intro → menu → map → briefing → game → results → ending
  story/campaign.ts    chapters, narration, lords, codex
  store/gameStore.ts   Zustand: screens, settings, persisted progress, HUD snapshot, banners
  audio/audio.ts       procedural Web Audio engine: score kit, cues, music loops, spatial SFX
  world/               terrain, eclipse sky + mood system, castles (+ collision/nav), vegetation,
                       particles, instanced soldier "puppets", hero models (rider, Kaalrath, dragons), post-FX
  cinematic/           director, shot programs (intro · menu · ending), set pieces
  game/                world gen, AI, physics, king controller, systems, camera, renderers
  ui/                  gate, title, menu, war map, briefing, chronicle, settings, HUD, pause, results
legacy/                the original components, kept for reference (not built)
```

The original project was a React Three Fiber scaffold; this remaster keeps its Vite + Tailwind + Cloudflare setup.
