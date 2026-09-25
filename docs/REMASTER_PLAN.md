# AGE OF KINGS — *The Endless Eclipse*
### Remaster master plan: story bible, cinematic scripts, game design and tech

This is the plan I wrote before any remaster code. Everything later in the codebase follows it.
Each section says **what** we build, **why** it matters to the story, and **how** it is built.

---

## 0. What the original was (analysis)

| Area | Original state | Problem |
|---|---|---|
| Intro | Lucide icons (swords, shield) fading in on a black loading screen | Not an intro at all. It only reported drei's HDRI download progress |
| Menu | One title, one button on a flat zinc background | No atmosphere, no motion, no story |
| Story | 6 campaign nodes with one-line descriptions | No characters, no stakes, no reason to care |
| World | Flat green 1000×1000 plane, box castles, random dodecahedron trees | Nothing grounds units in the world. No terrain, fog, time of day or mood |
| Units | One React component per soldier with ~15 meshes and its own `useFrame` | 2,400 soldiers in the final battle produce 36k draw calls and O(n²) targeting (≈5.7M distance checks per frame). It does not run |
| Physics | Units slide at constant speed, walk through castle walls, die by rotating in place | No weight, momentum, knockback or ballistics |
| Camera | Head-locked first person, no smoothing | No cinematic feel. You never see your king |
| Combat feel | Weapon cooldown 0.1s, damage numbers only | No hit-stop, shake, sparks or impact |
| Win rule | Kill every single enemy soldier | Tedious. The last 5% becomes a hunt for stragglers |
| Capture | Cage, carry and jail mechanic (a genuinely good idea!) | No stakes. Jail never ends, so there is no loss |
| Dragon | Summon cinematic with beams, orb, stone egg and roar (a good seed) | Free and unlimited, so no meaning |
| Audio | A few oscillator blips and pink-noise wind | No music, no score, no space (reverb) |

**What we keep and elevate:** the king on horseback, the weapons (sword, spear, bow), the
abilities (Rally, Charge, Slam), rakshas, eagles, the dragon-egg summoning, the cage-capture and
rescue mechanic, and the branching campaign graph (`start → invasion/diplomacy/defense → … → final`).
Every one of these now gets a story reason to exist.

---

## 1. Story bible

### 1.1 The world: Suryavarta, *the land held by the Sun*
Long ago a star fell and was forged into the **Sun Crown of Suryagarh**. The crown keeps
**Aruna, the Sun-Dragon**, asleep in a stone egg beneath the throne. In the legends, Aruna's
breath is what lights each dawn. While the crown is whole the sun rises, and the **Rakshas**
of the **Ashen Deep** (demons who burn in sunlight) stay underground.

### 1.2 The inciting night: the Blood Eclipse
**Kaalrath**, elder brother of the king, was passed over for the crown. He made a pact with the
Rakshas: *give me an army, and I will give you a world without sun.* On the night of the Blood
Eclipse he climbed the walls of Suryagarh and **shattered the Sun Crown with his black blade**.
The shards fell across the land like comets, and traitor lords rose where each one landed.
With the crown broken, the moon stays locked over the sun: **the Endless Eclipse.**

### 1.3 Characters
| Name | Role | Game presence |
|---|---|---|
| **Vikram**, the Last King | The player, on his war-horse *Toofan* | Third- or first-person controllable hero |
| **Devdutt**, the Old Minister | Narrator of every cinematic and briefing | Leads the rescue host (the old `minister` role) |
| **Kaalrath**, the Eclipse King | Antagonist and final boss | Giant armored warlord with a burning black blade |
| **Suparna**, the Eagle-Queen | Ally in the Eastern Peaks | Unlocks eagle riders (the `eagles` unit type) |
| **Aruna**, the Sun-Dragon | The hope of the realm, woken in the finale | Dragons summoned in-game are her *ember-kin* |
| **The Traitor Lords** | Enemy camp kings, each holding a crown shard | Named warlords with boss bars |

Traitor lords (name pool):
Ghorak the Flayer · Vashti of the Red Veil · Durjan Ironjaw · Malang the Hollow ·
Surtaq Emberbane · Rudrak the Unbroken · Nishachar the Night-Walker.

### 1.4 How the story explains every mechanic
| Mechanic | Story reason |
|---|---|
| Enemy camps with kings | Traitor lords, each holding a **crown shard** |
| Killing a lord | Slow-motion **kill-cam**. The shard rises from the body and **dawn returns a little** (the sky brightens) |
| Lord's soldiers after he dies | **Morale breaks.** Human soldiers kneel and **swear fealty** (they turn to your colors). Rakshas burn to ash, because the pact is broken |
| Cage capture | Kaalrath needs the king **alive**: royal blood completes the *Rite of Endless Night* |
| Jail | A **Blood-Moon timer** starts. Escape (rescue host, dragon, or your army) before it ends, or the rite completes and you lose |
| Dragon summoning | The **Ember Rite**: spend Ember (sun-fire freed from fallen enemies) to wake an ember-kin dragon from a stone egg |
| Recruit / backup | Ember buys soldiers. The Minister's host answers the war-horn |
| Lighting / time of day | **The Dawn meter.** Campaign progress literally pushes the moon off the sun. Chapter 1 is crimson night; the finale is amber twilight; the ending is sunrise |

### 1.5 Campaign graph (same shape as the original nodes)
```
               ┌─> II-A  The Burning Plains (invasion) ─┬─> FINAL  The Obsidian Citadel
I  Ashes of ───┼─> II-B  Wings of the East (alliance) ──┘         ▲
   Suryagarh   └─> II-C  The Siege of Suryagarh (defense) ─> II-A │
                   II-A ─> III  The Ember Roads (defense) ─────────┘
```
| Node id | Chapter | Mode | Twist |
|---|---|---|---|
| `start` | **I. Ashes of Suryagarh** | Reclaim | 3 lords near the capital. Tutorial hints |
| `invasion_1` | **II. The Burning Plains** | Invasion | Rakshas-heavy camps, wide open fields, war-horn raids |
| `diplomacy_1` | **II. Wings of the East** | Alliance | Start with Suparna's eagles plus one ember-dragon |
| `defense_1` | **II. The Siege of Suryagarh** | Siege | Waves assault **your** castle. Survive, then break them |
| `defense_2` | **III. The Ember Roads** | Escort / defense | Raids on your lines. More lords, more ember |
| `final_battle` | **IV. The Obsidian Citadel** | Boss | Kaalrath plus his last lords. He enters an eclipse phase at 50% HP |

---

## 2. Intro cinematic: *"The Night the Sun Died"*
About 80 seconds, fully real-time 3D, skippable (**hold Space / hold click**).
Letterboxed 2.39:1. Every camera move uses eased Catmull-Rom splines, so there are no linear moves.
Narration is Devdutt's voice as typed subtitles.

### 2.0 The Gate (before the intro)
Black screen. A single ember breathes in the dark. It drifts on the cursor and flares on hover.
> **AGE OF KINGS**
> *Headphones recommended.* **Touch the ember to awaken.**

Why: browsers block audio until the first click. We turn that limitation into a ritual.
On click the ember **explodes into sparks**, and the score's first heartbeat lands on the cut to Shot 1.

### 2.1 Shot list
| # | Time | Shot | Camera | Picture | Sound | Subtitle |
|---|---|---|---|---|---|---|
| 1 | 0–7s | **Before memory** | Slow push through a star field and golden dust | Stars fade in, a warm sun blooms at frame center | Heartbeat, sub drone | *"Before there were kings… there was the Sun."* |
| 2 | 7–16s | **Suryagarh** | Dives **through golden clouds**, then a sweeping crane down and around | The Sun Fortress at golden dawn: banners ripple, rivers glint, birds | Choir pad swells (major) | *"And the Sun had a keeper — the Crown of Suryagarh."* |
| 3 | 16–23s | **The Crown** | Slow dolly-in and orbit, low angle | The Sun Crown floats and turns above the altar between braziers; gems pulse | Shimmer bells | *"For a thousand years its light held back the dark… and kept the dragon dreaming."* |
| 4 | 23–31s | **The Eclipse** | Crane up and tilt to the sky | The moon slides over the sun, gold bleeds to crimson, the corona blazes, the world goes dark | Low **BRAAM**, wind rises | *"Until the night your brother traded the Sun… for a crown of shadow."* |
| 5 | 31–37s | **Kaalrath** | Low-angle push-in, lightning back-light | A giant armored silhouette on the gatehouse, red eyes, black blade, cape tearing in the wind | Thunder, choir drops out | ***KAALRATH — The Eclipse King.*** |
| 6 | 37–43s | **The Shattering** | Tight on the crown, **time freezes** | The black blade falls. Hit-stop, white flash, chromatic split, shockwave; the crown bursts into 7 burning shards | **Taiko hit**, glass shatter, silence | — |
| 7 | 43–51s | **Seven Fires** | High aerial, slow pan | Seven shards streak across the red sky with trails and land far away. Each impact raises a pillar of crimson light | Rolling impacts, low strings | *"Seven shards fell. Seven traitor lords rose to claim them."* |
| 8 | 51–58s | **The Horde** | Low tracking dolly along the column | Hundreds of soldiers and rakshas march through ash fog. Torches, burning eyes | War drums in march rhythm | *"And from the Ashen Deep… the Rakshas answered."* |
| 9 | 58–64s | **The Egg** | Macro creep-in | Beneath the throne a stone egg sits in the dark. One crack glows, in time with the heartbeat | Heartbeat returns, reversed shimmer | *"Yet beneath the ashes, the dragon still dreams…"* |
| 10 | 64–72s | **The Last King** | 180° orbit from behind to front, ending low | Vikram on Toofan on a ridge above the burning valley, cape roaring. He raises his sword; **lightning strikes the blade** and it ignites with solar fire | Thunder, choir surges | *"…and one king still stands. Rise, Vikram. Take back the light."* |
| 11 | 72–80s | **TITLE** | Whip-tilt up to the eclipse | The corona flares, a shockwave ring crosses the screen, an ember storm | Trailer **BRAAM** plus choir hit | **AGE OF KINGS** slams in (metal gold, light sweep); *THE ENDLESS ECLIPSE* types in |

### 2.2 Intro to menu (the ending of the intro)
The title doesn't cut away. **It lifts and shrinks into the menu header** while the camera settles
into a slow, endless orbit of Suryagarh under the eclipse. The 3D world stays live behind the menu:
embers drift and banners move. The menu items rise in one by one with a light sweep.
The website **is** the world. There's never a hard cut to a flat page.

---

## 3. Ending cinematic: *"Dawn"*
Plays after Kaalrath falls.
| # | Shot | Picture | Subtitle |
|---|---|---|---|
| 1 | Fall | Slow-motion: Kaalrath drops to one knee, and his blade cracks | *"The Eclipse King falls."* |
| 2 | Reforging | The shards spiral in from the horizon and the crown **reassembles** in mid-air | *"Shard by shard, the Crown remembers its shape."* |
| 3 | Waking | The stone egg cracks open and golden light floods out. **Aruna rises** | *"And the dragon… wakes."* |
| 4 | Breath | Aruna climbs and breathes a column of fire into the eclipse; the moon is pushed away | — |
| 5 | Dawn | The sun floods the land and sky blooms to gold. A crane rise over the army lifting their weapons | *"Dawn."* |
| 6 | Title | Fade to gold. *"The Endless Eclipse is over. The Age of Kings begins."* Credits roll | — |

---

## 4. Gameplay remaster

### 4.1 Core loop
Ride out → find a traitor lord's camp (compass and minimap) → break his army → kill the lord →
**kill-cam and shard** → his men kneel and join you → ember grows → summon dragons and recruit →
next camp → chapter victory → choose your path on the War Map.

### 4.2 Controls
| Input | Action |
|---|---|
| **Mouse** | Look / steer |
| **W A S D** | Ride (the horse has momentum and a turning inertia) |
| **Shift** (hold) | Gallop (uses stamina) |
| **Space** | Horse leap (real jump arc) |
| **LMB** (hold) | Attack: sword combo, spear throw, bow shot |
| **RMB** (hold) | Aim (over-the-shoulder zoom) |
| **1 2 3** / wheel-click | Sword / spear / bow |
| **Q** | War Cry: heals and empowers nearby allies |
| **E** | Sun Charge: armored dash that **launches** enemies |
| **R** | Solar Slam: shockwave that knocks everything back |
| **Z / X / C** | Army order: **Attack** (follow and fight) / **Guard** (ring formation around the king) / **Hold** (defend the castle) |
| **F** | Place or clear a rally point where you aim |
| **G** | Recruit a soldier (Ember) |
| **B** or **Alt** | Blow the war-horn: the Minister's backup host rides out |
| **O** | Ember Rite: summon a dragon (Ember) |
| **P** | Mount or dismount a nearby dragon |
| Dragon: **LMB / Tab** | Fire breath (continuous stream) |
| Dragon: **Space / Ctrl** | Climb / dive |
| **V** | Third-person ↔ first-person |
| **Wheel** | Camera distance |
| **Esc** | Pause |
| **H** | Toggle control help |

### 4.3 Physics and "realism" systems
* **Terrain**: a procedural height-field (fBm noise, 2 km). Castles sit on flattened plateaus and a
  mountain ring bounds the world. Every unit, projectile and camera follows the true ground height.
* **Rigid-body-lite unit physics**: velocity, acceleration limits (inertia), gravity, ground contact
  and friction. Knockback impulses make bodies airborne. Crowd **separation** uses a spatial hash, so
  armies press against each other instead of overlapping.
* **Ragdoll-style deaths**: the killing blow's impulse throws the body and it tumbles with angular
  velocity. Corpses stay on the field and sink away after a while.
* **Ballistics**: archers solve the real launch angle for gravity (with human error). Arrows fly in
  arcs, turn along their velocity, and **stick** in the ground and walls.
* **Castle collision**: walls block movement. Units route through the gate, so armies funnel into the
  gatehouse, which is realistic and tactical.
* **Horse**: momentum, turning inertia, gallop, stamina, leaps and landing impact.
* **Dragons**: banking flight, climb and dive, and fire breath particles that deal area damage.

### 4.4 Combat feel ("juice")
Hit-stop on heavy hits · trauma-based camera shake · FOV kick on gallop and charge · spark
and dust particles · chromatic aberration pulses · damage vignette · heartbeat at low HP ·
combo counter · slow-mo kill-cam on lords · boss bar for nearby lords.

### 4.5 AI
Per-unit state machine: `patrol → engage → attack → flee/kneel`, plus `carrier`, `rescue`,
`guard-formation`, `follow-king` and `rally`.
Targets come from spatial-hash queries on a staggered 0.3s timer instead of every frame.
Far-away camps **sleep**, so only nearby camps are simulated at full rate.

Special units:
* **Rakshas**: fast, aggressive, **leap attacks** (a physics jump at the target). Immune to fear.
* **Traitor lords**: heavy slam that knocks back everyone around them, a named boss bar, and a
  shard drop.
* **Kaalrath** (final): huge, with a shadow-wave shockwave, rakshas summoned through ground rifts,
  and an eclipse phase at 50% HP (the sky darkens and he gets faster).
* **Eagles**: circle above the fight and dive-strike.
* **War-horn raids**: every ~80s a random lord sends a raiding party at you. A HUD horn icon
  marks the direction.

### 4.6 Win and loss
* **Win**: every traitor lord in the chapter is slain (and Kaalrath in the finale).
* **Lose**: jailed and not freed before the Blood-Moon timer ends. In the Siege chapter, you also
  lose if the enemy holds your keep for 20 seconds.

### 4.7 Economy
Ember comes from kills: soldier 2, rakshas 5, lord 60. It pays for recruit (15), war-horn backup
(60, 45s cooldown) and the dragon Ember Rite (120).

---

## 5. Website, UI and motion design

### 5.1 Art direction
| Token | Hex | Use |
|---|---|---|
| Solar gold | `#F5B83D` / `#FFD98A` | Titles, highlights, player UI |
| Ember | `#FF6A1F` | Fire, ember resource, CTAs |
| Eclipse crimson | `#C0283A` / `#6E0F1D` | Enemy, danger, the eclipse |
| Night indigo | `#0A0B14` / `#141729` | Backgrounds |
| Royal blue | `#2F5DD8` | The player's army |

Type: **Cinzel** (display, carved-stone capitals) · **Cormorant Garamond** (narration, italic) · **Inter** (UI).
Texture: film grain, vignette, letterbox bars in cinematics, gold filigree rules.

### 5.2 Screens
1. **Gate**: the ember ritual (§2.0).
2. **Intro**: the real-time cinematic (§2).
3. **Main menu**: live 3D Suryagarh orbit and parallax to the mouse. Menu items:
   *Begin the Reclamation · Continue · The Chronicle · Settings · Replay the Prologue*.
   Hover gives a light sweep and a sound tick.
4. **The Chronicle**: a lore codex with cards for characters, places and the pact.
5. **War Map**: an illuminated parchment map with glowing path lines between chapters.
   Locked, current and completed states; the Dawn meter.
6. **Chapter briefing**: a big chapter numeral, typewriter narration by Devdutt, objectives, and a
   "Ride Out" button once the world is generated.
7. **HUD**: crest and health, stamina, ember · compass strip with camp, home and shard markers ·
   objective · minimap · army order · weapons and abilities with radial cooldowns · boss bar ·
   cinematic banners ("TRAITOR LORD SLAIN", "THE WAR-HORN SOUNDS") · combo counter.
8. **Pause**: resume, controls, settings, abandon.
9. **Results**: victory or defeat, stats (kills, lords, time, sworn soldiers), and the path choice.
10. **Ending**: the Dawn cinematic, then credits.

### 5.3 Motion principles
* **Nothing linear**: every animation uses expo / cubic ease-out or a critically damped spring.
* **Stagger**: lists enter 60–90ms apart.
* **Continuity**: the 3D world persists behind UI. We blend with fades and flashes, never hard cuts to flat pages.
* **Sound on motion**: every major transition has a matching audio cue.
* **Reduced-motion** (`prefers-reduced-motion`): turns off shake, flashes and grain.

---

## 6. Audio design: a fully procedural score (Web Audio)
No audio files at all. Everything is synthesized, so it loads instantly.
* **Bus**: master → compressor → out, with a reverb send (a generated 3.5s impulse response).
* **Score kit**: sub drone, heartbeat, choir pad (detuned saws through vowel formant filters),
  taiko (sine pitch-drop plus noise), **braam** (stacked low saws with an opening filter),
  shimmer (high sine bells with delay), thunder (filtered noise with a rumble tail), and a
  santoor-like pluck melody in the Bhairav raga scale (1 ♭2 3 4 5 ♭6 7) for an Indian-epic color.
* **Cue scheduler**: the intro director fires cues on exact timeline beats.
* **Menu theme**: an evolving drone, pad progression, sparse plucks and a distant drum.
* **Battle music**: a drum layer whose intensity follows nearby combat.
* **SFX**: metal clash (inharmonic partials), bow twang, arrow whoosh, impacts, hooves
  (a 3-beat gallop), horn, roar, fire, shatter and UI ticks.

---

## 7. Technical architecture
```
src/
  App.tsx                 screen router: gate → intro → menu → map → briefing → game → results → ending
  store/
    gameStore.ts          Zustand UI state, settings, persisted campaign progress
    sim.ts                mutable simulation world (units, projectiles, fx, camps, shards)
  story/campaign.ts       chapters, narration, level configs, lord names, codex
  audio/audio.ts          procedural audio engine, score cues, SFX
  world/                  shared 3D: noise, terrain, sky dome, castle, vegetation, particles, materials
  cinematic/              director (shots, splines, easing), intro and ending set pieces, overlay
  game/                   game scene, simulation step, instanced unit renderer, player rig,
                          camera rig, projectiles, fx, dragons, shards, cage, post-fx
  ui/                     gate, menu, chronicle, war map, briefing, HUD, pause, results
```

### 7.1 Key engineering decisions
* **One simulation loop**: a single `useFrame` runs `simulate(dt)`, not N per-unit components.
* **Instanced unit rendering**: each body part (legs, torso, head, arms, weapons, shields,
  crowns, horns, eyes, wings) is one `InstancedMesh`. Matrices are computed per frame from the
  unit pose, so about 20 draw calls render thousands of soldiers.
* **Spatial hash** (8m cells) for targeting, separation and projectile collision: O(n·k), not O(n²).
* **Simulation LOD**: units far from the king tick at low frequency.
* **Time scale**: `simTime` is separate from real time, for hit-stop and kill-cam slow motion.
* **Deterministic cinematic**: every intro element is a pure function of `t`, so the director can
  skip, scrub (`?t=40`) and loop.
* **No network assets**: no HDRI downloads (the original stalled on drei's CDN). Lighting,
  reflections (`Lightformer` environment), textures and audio are all generated.
* **Code-splitting**: the gate loads instantly. Intro and game chunks load lazily.
* **Quality presets**: *Cinematic / Balanced / Performance* control DPR, shadows, post-FX and grass density.
* **Post-FX**: bloom (mipmap blur), vignette, film grain, animated chromatic aberration, ACES tone-mapping.

### 7.2 Debug hooks (used for verification)
* `?t=SECONDS` starts the intro at a timestamp.
* `?screen=menu|map|game|ending` jumps to a screen.
* `?chapter=<nodeId>` picks the chapter for `?screen=game`.

---

## 8. Build phases and checklist
- [x] P0: analyze the original, write this plan
- [x] P1: foundation (deps, fonts, theme, store, router, audio engine)
- [x] P2: shared world (noise, terrain, sky, castle, vegetation, particles)
- [x] P3: gate, intro cinematic, overlay, menu with live background
- [x] P4: game (simulation, physics, instanced units, player and camera, projectiles, fx, dragons, shards, cage, post-fx)
- [x] P5: HUD, pause, results, war map, briefing, chronicle
- [x] P6: ending cinematic and credits
- [x] P7: verify (typecheck, build, headless screenshots of every shot and screen, `npm run simtest` soak test of every chapter)
- [x] P8: README update, commit, push
