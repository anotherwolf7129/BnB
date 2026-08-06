# BnB

An open recreation of Nexon's **Crazy Arcade (크레이지 아케이드) BnB**, built from a
reverse-engineering spec of how the original actually behaves.

Nexon announced on 11 June 2026 that Crazy Arcade shuts down on **13 August 2026
at 09:00 KST**, after 25 years. This is an attempt to keep the simulation itself
alive: the balloon physics, the trapped-in-a-bubble state, the straddle
mechanic, and the specific texture of the game's own AI opponents.

> Place water balloons to trap opponents inside a water bubble, then pop the
> bubble to eliminate them.

Everything else is a modifier on that sentence.

---

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 80 headless simulation tests
npm run build      # typecheck + production bundle
```

No assets to fetch — every sprite is drawn procedurally to a canvas.

### Controls

| Key | Action |
|---|---|
| Arrow keys | Move |
| Space | Place a water balloon |
| 1–9 | Select an inventory slot |
| Ctrl | Use the selected slot |

The original's second couch-play scheme (R/D/F/G + LShift + LCtrl) is wired up
in `src/input.ts` as `COUCH_P1_KEYS`, but nothing in the UI binds a second
human player yet.

---

## What's here

This follows the spec's build order. Milestones 1–4 are done, plus most of the
협공배틀 scaffolding from milestone 5.

### The core simulation

* **15 × 13 tile grid**, four tile kinds (soft, pushable heart blocks, hard
  scenery, spikes) plus a floor layer for items and traps.
* **Straddling (걸치기)** — the single most important non-obvious mechanic. A
  character's *logical* tile lags behind their drawn position, and hit
  detection resolves against the logical tile. Park on a boundary line and you
  can stand visually inside a water jet and survive it.
  Pickups deliberately use the *physical* tile instead, which is what lets you
  slide along boundaries farming items while staying safe from jets.
* **Balloons and jets** — fixed fuse, cross-shaped jet, one destructible block
  per direction, hard blocks stop the jet without breaking, and live balloons
  caught in a jet detonate immediately. Chain detonation is instant while
  independently placed balloons stagger, so a straight line (일자) is nearly
  unavoidable and a crooked line is easy to dodge. That asymmetry is a feature,
  not a bug to fix.
* **The trapped state** — being hit does not kill you. You are encased in a
  bubble that grows more opaque; you can still move, extremely slowly, but you
  cannot place. A teammate frees you on contact (a save); an enemy pops it (a
  kill). A needle escapes instantly. Drowning kills you but *denies the
  opponent the kill* — which is exactly why players sometimes refuse the oxygen
  tank.
* **The 12 basic characters**, with Nexon's own 개수 / 물줄기 / 속도 base→max
  table. The paid 럭셔리 / 슈퍼 tiers are deliberately not shipped.
* Deterministic, fixed-timestep, seeded, and fully headless-testable — the
  renderer never touches simulation state.

### Items

Stat-ups (물풍선, 액체, 울트라, 롤러, 붉은 악마, 스케이트, 장갑, 신발, 슈퍼맨),
stat-downs and traps (초록 악마, 보라 악마, 압정, 바나나 껍질, 트랩, 본드),
utility (유령, 위장도구, 드릴, 산소통, 문워크, 금빛 악마), and a shop layer
(바늘, 실드, 물약, 스프링, 파워산삼, 센서, 다트, 무선 물폭탄).

The details that matter are in: a trap cannot be cleared by water at all, so it
is genuine area denial; picking up an oxygen tank destroys a held needle;
superman is *not* invulnerability and cancels when a jet hits you; a shield is
total invulnerability but each hit eats into its duration; a remote bomb does
not count against your balloon limit, so it enables an attack from a "no
balloons left" state.

The **item plane** flies on the documented remaining-clock windows — 1:59,
1:36, 1:14, 0:51, 0:29, 0:07 — dropping up to two items per pass, and does not
appear on the ghost maps.

**Rulesets** are the pre-match loadout, offered as the original's four culture
presets: 노샵 / 기샵 / 풀샵 / 올노. Since nothing is for sale here, the loadout
is a difficulty dial rather than a monetisation surface.

### The AI

Modelled on 협공배틀's own opponents. The goal was never "unbeatable" — it was
to reproduce the specific texture: dodges competently, gets cornered by
enclosure rather than by trickery, rescues its allies at its own peril, and
degrades believably at low tiers.

The architecture is a 10 Hz tick over a **danger map** (for every tile, the
earliest time a jet will cover it), an escape BFS that only expands tiles it
can reach with margin to spare, then attack / rescue / collect / farm intents
scored against each other.

The difficulty ladder is reproduced as discrete behavioural tiers rather than
as stat inflation:

| Tier | Level | Behaviour |
|---|---|---|
| ★1 | 3 | Appears not to understand the rules. Picks items up but **cannot use them**. |
| ★2 | 10 | Understands the basics and uses items. Dodges well *at first*, then starts walking into blast tiles. |
| ★3 | 43 | Between ★2 and ★4. |
| ★4 | 52 | **Always** recognises blast tiles, indefinitely. You cannot bait it — you must enclose it. |
| ★5 | 109 | ★4 plus it carries and uses 바늘 and 실드. |
| ★6 | 163 | ★5 plus 스프링 — it hops your containment walls. |

Two behaviours are worth calling out because they are faithful *weaknesses*:

* **Dodge decay** is ★2's documented "gets tired" behaviour, implemented
  literally — after 45 seconds the chance of ignoring the danger map ramps from
  0 toward 35%. It is suppressed on the dodge only, never on the rest of the
  behaviour, so it reads as fatigue rather than as random flailing.
* **Rescue is baitable.** When one AI is bubbled another comes for it, and
  below ★5 it does not check whether the approach is covered. Players
  deliberately bait this to catch two at once. That is by design.

Anti-frustration rules from the spec are in: the AI never places on or beside a
spike (the bug that got Camp excluded from 협공배틀 in the original), and at
tiers ≤ ★3 no more than two enemies engage you at once.

### Game types

* **일반모드** — standard elimination; wipe the enemy team or hold more
  survivors at 3:00.
* **부활대전** — 2:00, respawn on a countdown, score on kills, deaths as the
  tiebreaker.
* **고슴도치** — the dead become hedgehogs: they detonate balloons on contact,
  are stunned by jets, and free bubbles *indiscriminately*, so you have to be
  careful not to hand an enemy their life back.
* **대장잡기** — one flagged captain per team; killing the enemy captain wipes
  their whole team, and the killer leads the next round. A disguise does not
  change the flag colour.
* **시한폭탄** — a random carrier, speed locked to their maximum, 5-second
  timer, passed on contact, 5×5 blast on expiry.

### Maps

Three, authored as ASCII in `src/sim/maps.ts` so new ones are cheap:

* **파티라 14 (Patrit 14)** — wide, symmetric, mostly soft blocks, a central
  structure and four pillars. No spawn holds a positional advantage, which is
  exactly why it is the community's most-played map.
* **캠프 (Camp)** — carries spikes, and is flagged as closed to the AI,
  mirroring the original's exclusion of it from 협공배틀.
* **공동묘지 (Graveyard)** — a ghost map, so the item plane does not fly.

### Rank

D through SS, from kills, saves, deaths, enemy tier and clear time — with the
1:30 par time intact. The one deliberate departure: the original rewarded
*more* shop items used, because that was a monetisation nudge. Here the
incentive is inverted, so restraint scores better.

---

## Testing

The spec lists the player techniques that must emerge naturally from the
physics; those make the integration suite. 걸치기, 슬라이딩, 가두기, 일자, 연사,
and the 2v1 cross-line pin are all covered, along with a regression guard that
the AI does not blow itself up in its own spawn corner.

```
test/straddle.test.ts   first-tile hit resolution, sliding, safe item farming
test/jet.test.ts        propagation, block rules, chains, 일자 vs crooked timing
test/trapped.test.ts    rescue, enemy pop, needle, drown-denies-kill, shield
test/items.test.ts      stat caps, devils, traps, item plane windows, maps, rank
test/ai.test.ts         danger map, chain resolution, the tier ladder, behaviour
test/modes.test.ts      all four alternate game types
test/match.test.ts      full-match stability
```

---

## Source reliability

The spec this was built from tags every factual claim, and the code keeps those
tags in the comments:

| Tag | Meaning |
|---|---|
| `[OFFICIAL]` | From Nexon's own site or press releases |
| `[COMMUNITY]` | From long-lived Korean player documentation |
| `[DESIGN]` | Our own proposal, not from the original |
| `[VERIFY]` | Genuinely unknown — needs measurement against the live game |

Every tunable lives in `src/sim/constants.ts`, and the `[VERIFY]` ones are the
values worth measuring before 13 August 2026:

1. Exact playfield grid dimensions (we use 15 × 13)
2. Balloon fuse duration (we use 2.5 s)
3. Drown duration, and how much faster 로두마니 drowns (5 s, ×0.6)
4. Movement speed in tiles/second for each speed stat 1–10
5. Movement speed while bubbled
6. Block→item drop probabilities and the per-map item pools
7. 실드 duration and how much a jet hit reduces it
8. 파워산삼's exact stat delta
9. Dismount landing delay — this determines whether 내림킬 is possible
10. Whether the 일반모드 clock is exactly 3:00

If you can capture footage or measurements from the live game before it goes
down, those ten numbers are the highest-value thing to bring back.

---

## Not built yet

Called out honestly rather than left to discover:

* **몬스터모드** — 81 PvE maps, out of scope by design.
* **협공배틀 as a mode shell** — the enemy rosters (나이트메어 / 탑걸스 /
  탑가이즈), their tier ranges and battle-point unlock costs are all in
  `src/sim/characters.ts` and drive opponent naming, but there is no
  battle-point economy or unlock progression, and the **stalker event** is not
  implemented.
* **Vehicles (탈것).** The dismount landing delay that 내림킬 depends on is
  modelled on the player (`landingDelay`), but no vehicle grants it yet.
* **Second human player.** The keymap exists; the UI does not.
* **Luxury / super character tiers**, deliberately.
* Sound.

## Layout

```
src/sim/       headless simulation — no DOM, no rendering
  constants.ts every tunable, tagged by source reliability
  world.ts     the step loop: movement, balloons, jets, items, modes, win checks
  movement.ts  collision, corner assist, and the straddle commit rule
  maps.ts      ASCII map definitions and per-map item pools
src/ai/        danger map, pathfinding, tier table, controller
src/render/    procedural canvas renderer
src/input.ts   keyboard schemes
src/main.ts    menu, game loop, HUD
test/          headless simulation tests
```

## Licence

Fan project, non-commercial. Crazy Arcade and its characters are Nexon's.
