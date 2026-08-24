# VOIDRUNNER

**A deep-space infinite flight simulator.** Pilot a starfighter through an endless, procedurally-generated universe — threading asteroid fields, slingshotting past ringed planets, escaping the gravitational pull of black holes, blowing up fuel tanks, and racing the ghost of your own best flight.

Built from scratch with **Three.js**, **WebGL**, custom GLSL shaders, procedural geometry/textures, and a fully synthesized WebAudio soundscape. No downloaded assets. No build step. Runs anywhere a browser runs.

**New pilots get a gamified, step-by-step training mission on first launch** — learn by doing in 60 seconds, with plain-language cards, progress dots, and +500 XP on completion.

<p align="center">
  <b>PLAY LIVE → <a href="https://voidrunner-neon.vercel.app">https://voidrunner-neon.vercel.app</a></b>
</p>

<p align="center">
  <img src="docs/screenshot-menu.png" width="32%" alt="Main menu over live attract-mode flight">
  <img src="docs/screenshot-gameplay.png" width="32%" alt="Gameplay — nebula, asteroids, engine trails">
  <img src="docs/screenshot-hangar.png" width="32%" alt="Hangar with unlockable ship skins">
</p>

---

## Table of Contents

- [Gameplay](#gameplay)
- [Controls](#controls)
- [Weapons & Power-Ups](#weapons--power-ups)
- [Scoring, Objectives & Rewards](#scoring-objectives--rewards)
- [Hazards & Survival Constraints](#hazards--survival-constraints)
- [Sectors & Ghost Racing](#sectors--ghost-racing)
- [Feature Highlights](#feature-highlights)
- [Performance Engineering](#performance-engineering)
- [Tech Stack & Architecture](#tech-stack--architecture)
- [Run Locally](#run-locally)
- [Quality Tiers](#quality-tiers)
- [Browser Support](#browser-support)
- [Roadmap](#roadmap)
- [Credits & License](#credits--license)

---

## Training Mission (first launch)

First time players jump straight into a **gamified training run** — no manuals needed:

1. **Steer** — grab 5 crystals spawned just for you
2. **Boost** — hold the boost control for a moment
3. **Shoot** — aim at practice rocks; your guns do the work
4. **Roll** — try a barrel roll
5. **Gate** — fly through a real boost ring
6. **Done** — +500 XP, and the real universe opens up

Cards use plain language, show the exact keys/buttons for *your* device (mouse, touch, or gamepad), and can be skipped anytime. Replay via **REPLAY TRAINING** in the menu. A hint bar also appears for the first seconds of every normal run, matched to your input device.

## Gameplay

VOIDRUNNER is an infinite runner in three dimensions. Your ship flies forward automatically; you control lateral movement, throttle, evasive maneuvers — and your auto-cannon does the shooting wherever you point the reticle.

Every run is different. A weighted spawn director generates patterns across five difficulty tiers that ramp with distance:

| Pattern | Description |
|---|---|
| **Asteroid Fields** | Scattered tumbling rocks with drift, rotation and destructible HP |
| **Asteroid Walls** | A full grid of rock blocking the corridor — one gap, find it |
| **Crystal Trails / Rings** | Sinusoidal chains and circular formations of void crystals |
| **Boost Gates** | Torus gates that award bonuses and refill power |
| **Planets** | Procedurally-textured worlds — ringed giants at the corridor's edge, dwarf planets as lethal obstacles inside it |
| **Black Holes** | Gravity wells with physically-scaled pull (`F ∝ 1/d²`), orbiting debris fields, photon rings — escape for bonus points, cross the horizon and be consumed |
| **Comets** | Fast diagonal strikers with particle tails — high threat, high reward |
| **Fuel Tanks** | Explosive canisters — one shot detonates them for big points and loot |
| **Satellites** | Tumbling solar-panel hazards with blinking beacons |
| **Proximity Mines** | They arm and blink faster as you approach — shoot them from range |
| **Ice Fields** | Translucent crystal shards drifting through the corridor |
| **Alien Artifacts** | Rare glowing monoliths — fly close to scan for +250 |
| **Space Stations** | Massive ringed stations drift past on every sector change |

Glowing **corridor buoys** mark the flyable space at all times, so you always know where to fly.

## Controls

Everything is reachable with **the mouse alone** on desktop — plus full gamepad and touch support.

| Action | Mouse | Gamepad | Keyboard (optional) | Mobile |
|---|---|---|---|---|
| Steer | Move cursor / stick / lock modes | Left stick | WASD / Arrows | Drag anywhere |
| Aim weapons | Reticle position | Reticle position | Reticle position | Reticle follows drag |
| Boost | Hold LMB | RT / A | Shift | BOOST button |
| Brake | Hold RMB | LT / B | S / Ctrl | BRK button |
| Barrel roll | MMB | X / RB | Space | ROLL button |
| Pause | Button | Start | P / Esc | Button |
| Audio | Button | — | M | Button |

### Three mouse modes (Settings → Controls)

- **AIM** — classic absolute steering: the ship flies toward your cursor.
- **STICK** — mouse movement acts as a self-centering virtual stick (relative control).
- **LOCK** — click to capture the pointer for FPS-style mouselook; Esc auto-pauses.

Additional options: sensitivity, invert X/Y, camera shake intensity (0–100%), auto-cannon toggle, left-handed touch layout, ghost toggle.

## Weapons & Power-Ups

- **Auto-cannon** — fires plasma bolts at any asteroid or comet inside your reticle cone (5 rounds/s). Sustained fire builds **heat**; at 100% the cannons lock out until cooled. Destroyed rocks shatter into debris and can drop crystals or power-ups.
- **SHIELD** — absorbs the next 2 impacts (visible deflector bubble).
- **REPAIR** — restores 35 hull.
- **SURGE** — 8 seconds of free overdrive boosting.
- **SCORE x2** — 12 seconds of doubled points.

## Scoring, Objectives & Rewards

| Event | Reward |
|---|---|
| Distance | Continuous: `speed × Δt × multiplier` |
| Void Crystal | +150 × multiplier (magnet pickup) |
| Boost Gate | +350 × multiplier, +16 power |
| Near Miss | +75 × multiplier (comets +150) |
| Asteroid Kill | +30 × multiplier, chance of drops |
| Comet Kill | +120 × multiplier |
| Gravity Well Escape | +400 × multiplier |
| Objective Complete | +400 XP |
| Hull damage | Combo resets |

Combo multiplier climbs to **x5**. Score converts to XP (`score/60 + crystals×2 + gates×6 + near-misses + objectives`).

**Progression:** levels unlock 7 ship skins (live 3D hangar preview), +5 max hull per level, 14 achievements, per-run objective system (3 of 8, rerolled every run), career profile with 10 tracked lifetime stats, and a local top-10 runs leaderboard.

## Hazards & Survival Constraints

1. **Hull integrity** — impacts deal damage; self-repair after 4.5s of calm.
2. **Black holes** — inverse-square gravity bends your trajectory; warning banner, klaxon and camera shake escalate inside the well. The event horizon is fatal.
3. **Edge field** — leaving the navigation corridor burns hull every half-second.
4. **Power economy** — boost drains energy; gates and coasting refill it.
5. **Weapon heat** — overzealous gunnery locks your cannons at the worst moment.

## Sectors & Ghost Racing

- Every 4 km you enter a new **named sector** — spawn pressure steps up and the nebula palette shifts to a new biome (6 hand-tuned palettes, smoothly cross-faded in the sky shader).
- **Ghost racing** — your best run's flight path is recorded and replayed as a translucent wireframe ship to race against, every future run. Toggleable.
- Async "multiplayer against yourself" — plus a persistent local leaderboard.

## Feature Highlights

**Rendering**
- Custom GLSL everywhere: fbm nebula with live palette cross-fade, black-hole accretion disk + orbiting debris field, planet atmosphere fresnel shells, procedural ring shaders
- Infinite parallax starfield and speed-reactive dust computed entirely in vertex shaders (position wrapping — no float-precision decay, ever)
- UnrealBloom with HalfFloat targets and MSAA, ACES filmic tone mapping

**Simulation**
- Chase camera with exponential smoothing, velocity lead, FOV kick, trauma-based shake (configurable)
- Object-pooled everything: bolts, explosions, debris, shockwaves, flash lights, gates, planets, black holes
- Treadmill world motion — ship stays near origin; infinite runs never lose float precision

**Presentation**
- Procedural fighter with blinking nav lights, plasma exhaust plume, deflector shield bubble
- Ghost ship rendered as a translucent wireframe of your best flight
- Live attract mode — menus float over the actual simulation
- Canvas radar with 7 threat classifications and sweep line
- Full WebAudio synthesis: throttle-linked engine, laser fire, overheat hiss, pickup arpeggios, gate chords, alarms, sector stingers, ambient drone

## Performance Engineering

- **Instanced rendering** — all asteroids and crystals draw in 2 draw calls regardless of count (InstancedMesh with per-frame composed matrices)
- **Dynamic Resolution Scaling** — in AUTO quality, frame-time EMA continuously scales render resolution between 60–100% (0.6 floor), stepping down under load and back up when headroom returns
- **Zero-allocation hot path** — preallocated vectors/matrices, ring-buffer trails and comet tails, no per-frame object churn
- **Throttled UI** — HUD text at 10 Hz, radar at 20 Hz, bars via GPU-friendly `transform: scaleX` (no layout thrash)
- **GPU-side animation** — star twinkle, black-hole debris orbits and crystal pulse run in shaders, not JS
- WebGL context-loss handling with auto-pause

## Tech Stack & Architecture

- **Three.js r160** via ES-module import map — no bundler required
- Vanilla ES2022, zero frameworks

```
index.html          Entry point, import map, all UI layers/DOM overlays
css/style.css       Full UI system: HUD, menus, hangar, profile, animations, responsive rules
js/main.js          Bootstrap, state machine, flight physics, weapons/heat, power-up effects,
                    gamepad, mouse modes, DRS, sectors, objectives, ghost, run lifecycle
js/world.js         Instanced asteroid/crystal fields, spawn director, pattern generators,
                    collisions, gravity, bolt interception, power-ups, comets, radar feed
js/fx.js            Shader starfield, dust, nebula with sector palettes
js/fx2.js           Explosion/shockwave/debris/flash pools, zero-alloc trail ribbons
js/ship.js          Procedural fighter, nav lights, exhaust, shield bubble, ghost variant
js/ui.js            DOM layer manager, HUD, radar, hangar/profile/achievement panels
js/audio.js         WebAudio synthesizer: engine, lasers, SFX, alarms, music pad
js/save.js          Persistence, XP curve, skins, sectors, achievements catalog
test-headless.mjs   Puppeteer E2E suite (16 checks)
test-live.mjs       Production smoke test
docs/               Screenshots
```

## Run Locally

Any static file server works — ES modules require HTTP (not `file://`):

```bash
cd voidrunner
python -m http.server 8080
# or
npx serve .
```

Open `http://localhost:8080`.

### Automated Tests

```bash
npm install
npm test        # headless E2E: boot, menus, gameplay, pause, persistence (16 checks)
npm run test:live   # smoke test against the production deployment
```

Requires Edge (path configurable in the test files). Tests run on a software-GL renderer and tolerate low headless frame rates.

## Quality Tiers

| Tier | Pixel Ratio | Bloom | MSAA | Stars/Dust | DRS |
|---|---|---|---|---|---|
| Low | 1.0 | off | 0 | reduced | off |
| Medium | ≤1.5 | 0.65 | 0 | mobile counts | off |
| High | ≤2.0 | 0.85 | 4x | full | off |
| **Auto** | device-based, **adaptive 60–100%** | yes | yes | by device | **on** |

## Browser Support

Chrome/Edge 90+, Firefox 90+, Safari 15+ (desktop & iOS). Requires WebGL. Audio unlocks on first interaction. Gamepad API supported in all modern browsers.

## Roadmap

- Global leaderboard (Vercel Functions + Redis)
- Live multiplayer racing via WebRTC
- Boss encounters
- Daily seeded challenges

## Credits & License

Built by **[Aniruddha Adak](https://github.com/aniruddhaadak80)** · AI Agent Engineer / Full-Stack Developer

- Rendering: [Three.js](https://threejs.org) (MIT)
- All game code, shaders, procedural assets, audio synthesis and design: original work

Licensed under the MIT License.
