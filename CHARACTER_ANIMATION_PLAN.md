# Plan: animate the character model for idle / walking / running

Goal: on the Health screen, the 3D character (`CharacterModel.tsx`) should
visibly walk or run when the in-game character is moving, and stand
(current behavior) when idle.

## What we have today

- `xModel.ts` parses PZ's ASCII `.x` meshes into static geometry + skin
  bindings (bone name, vertex weights, inverse bind matrix). There are
  **no animation clips or keyframes anywhere in the pipeline** — PZ ships
  bind-pose meshes only, and nothing currently extracts a walk cycle from
  the game.
- `CharacterModel.tsx` already does one hand-rolled "pose": `armPosesFrom`
  computes a rotation per arm (shoulder pivot → target direction) and
  `poseArmsDown` applies it by CPU-blending vertex positions per skin
  weight, run **once** at figure build time, to bring the T-pose arms down
  to the character's sides.
- The mod (`PZDashboard_Collectors.lua`) does not report movement at all
  today — no speed, no `isMoving`/`isSprinting`, no facing/heading. Only
  `map.x`/`map.y` position ticks every ~0.5s.
- Bone naming follows a standard Biped skeleton (`Bip01_L_UpperArm`,
  `Bip01_Pelvis`, `Bip01_Spine`, `Bip01_L_Foot`, …), so leg bones almost
  certainly exist as `Bip01_L_Thigh` / `Bip01_L_Calf` / `Bip01_L_Foot` and
  the `_R_` equivalents, but this hasn't been confirmed against real mesh
  data yet.

**Consequence:** there is no "real" animation to play back. Any walk/run
motion has to be a hand-authored, procedural approximation (sinusoidal
limb swing), the same spirit as the existing arm-drop hack — not something
extracted from the game.

## Step 1 — get movement state out of the game

Two options, not mutually exclusive:

- **Mod-reported (preferred, more accurate):** add a field to the `status`
  collector (or a new lightweight category) sourced from the player's
  actual movement/animation state — candidate PZ API surface to spike:
  `IsoGameCharacter:isSprinting()`, presence of a `PathFindBehavior2`,
  `getMoveSpeed()`/velocity accessors, or whatever the Build 42 API
  actually exposes (unconfirmed — needs the same kind of API spelunking
  the `pz-mod-server` skill already did for other fields). Yields a clean
  `idle | walking | running` enum with no guesswork.
- **Client-inferred (no mod change):** derive speed by differencing
  consecutive `map:position` fixes on the server or client and threshold
  it. Cheaper to ship, but noisy — position only updates every ~0.5s, so
  velocity estimate is coarse, and it can't distinguish "walking" from
  "running" as cleanly as an authoritative game-side flag, nor "stopped"
  from "between fixes."

Recommendation: spike the mod-side flag first; fall back to inference only
if the API doesn't expose anything usable.

## Step 2 — get the state to `CharacterModel`

- Add a derived subscription (e.g. key `'movement'`) alongside the
  existing `'vitals'`/`'hotbar'` pattern in `gameSocket.ts`'s
  `useGameSubscription`, publishing `idle | walking | running`.
  `EquipmentPanel.tsx` reads it and passes it down as a new
  `CharacterModel` prop, e.g. `movement={...}`.
- On state change, cross-fade animation parameters (blend the previous
  and next cycle's amplitude/speed over a few hundred ms) rather than
  snapping, so switching states doesn't pop.

## Step 3 — the animation itself

Generalize the existing arm-pose trick from "one fixed rotation, applied
once" to "an angle that varies over time, applied every frame":

- Extend `armPosesFrom`/`poseArmsDown` into a general per-bone-chain
  rotation utility, driven by a phase accumulator advanced each
  `requestAnimationFrame` tick (already the home of the render loop) by
  `dt * cycleSpeed`, where `cycleSpeed` depends on `idle | walking |
  running`.
- Animate: leg swing (thigh/calf opposing left/right), a smaller
  opposite-phase arm swing, and optionally slight pelvis/torso bob and
  lean (more lean + amplitude for running than walking; idle gets a very
  subtle sway/breathing motion instead of a dead-static pose).
- **Two ways to actually move the vertices per frame — needs a decision,
  not made here:**
  1. **CPU vertex blending** (extends today's code as-is): every frame,
     recompute blended positions per animated bone the same way
     `poseArmsDown` already does, write into the existing
     `BufferAttribute`, and set `needsUpdate = true`. Minimal new
     machinery, but redoing an O(vertices × affected bones) blend for
     every worn part on every frame is real per-frame CPU cost that
     hasn't been measured — risk on the Ayaneo handheld target.
  2. **Real GPU skinning**: build an actual `THREE.Bone` hierarchy from
     the parsed bone names + rest transforms, convert body/clothing
     meshes to `THREE.SkinnedMesh` + `THREE.Skeleton`, and drive bone
     rotations directly (or via `THREE.AnimationMixer` + a hand-authored
     `THREE.AnimationClip`). Offloads the per-vertex work to the GPU
     (where skinning belongs) and gives a cleaner foundation for any
     future pose, but is a bigger lift: `xModel.ts` only keeps flat
     inverse-bind matrices today, not a parent/child bone tree, so that
     needs building first.

  Suggested order: spike (1) on legs only, idle-only (no game data wired
  yet), to validate visual quality and measure frame cost before deciding
  whether it's worth building (2).

## Open questions / risks to resolve before implementing

- **Does animating this screen even make sense?** The character model
  only appears on the Health/Equipment screen, which the player opens
  deliberately — they're likely standing still checking their gear
  whenever this is visible in practice. A running animation may rarely
  be seen in the state where it'd matter. Worth confirming this is
  wanted before investing, versus only doing a subtle idle animation.
- Leg (and pelvis/spine) bone names are assumed from convention, not
  confirmed — first implementation step should dump `/api/model/mesh`
  skin data and check actual names, same as was done for arms.
- Per-frame CPU blending cost across all figure parts (body + every worn
  clothing layer) is unmeasured — needs a real perf pass on the actual
  target device, not an assumption.
- No ground-truth animation reference exists, so the result will look
  "plausible," not like PZ's actual walk/run animation — worth setting
  that expectation up front.
