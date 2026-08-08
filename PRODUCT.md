# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React with Mantine component library. No build/scaffold exists yet in this repo; this is greenfield. Design-first: Figma design is being produced before any code is written.

## Users

Project Zomboid players running the game on a PC, using a second screen (phone or tablet) with a real touch-friendly browser to view and interact with live game state while playing. Single-player focus implied by the feature set (character condition, inventory, skills); no admin/multi-player-management role has been established.

## Product Purpose

A companion, browser-based interface for a Project Zomboid mod. It surfaces live character state and lets the player act on it from a second device while the game itself runs on the PC, so the player doesn't have to break flow by looking away from the game screen or reaching for mouse/keyboard for quick checks and actions.

## Positioning

Not a spectator overlay — it is interactive: it reads live character state from the game and can also act on it (assumed: equip/use/drop items, trigger toolbar/hotbar slots), functioning as a second, touch-native control surface rather than a passive stats readout.

## Operating Context

Used mid-session, likely one-handed or glanced at quickly, on a touch device separate from the PC running the game. The mod is assumed to expose the underlying game state and accept actions over a local network API; the API contract itself is out of scope for this design/product record and will need definition when implementation starts.

## Capabilities and Constraints

Confirmed surfaces to design:
- User condition (health/moodles-style status)
- Map
- Inventory (interactive — items can be acted on, not just viewed)
- Toolbar/hotbar (interactive — slots can be triggered)
- Skills

Undecided / out of scope for now:
- Exact action set per surface (e.g. which inventory actions: equip, drop, use, split stack, etc.) — not yet specified, will need confirmation during detailed design/build.
- Whether this is single-player only or also usable by a second player/spectator on a shared server — not established.
- The mod-side API/data contract that will back this UI.
- Any admin, multiplayer-roster, or server-management surface — not requested.

## Evidence on Hand

None. No existing code, mockups, or brand assets in this repository beyond a LICENSE file. No incumbent visual system exists.

## Product Principles

1. Never make the player choose between watching the game and using the tool — glanceable status, then fast, confident action.
2. Touch is the primary input; every interactive target is sized and spaced for a thumb, not a cursor.
3. Interactive parity with intent — if a surface shows state that the game itself lets you act on (inventory, toolbar), the companion should let you act on it too, not just mirror it.
4. Design for the second-screen moment: quick glances and short interactions, not sustained reading sessions.

## Accessibility & Inclusion

No product-specific requirement established beyond touch-friendliness, which is already captured as a core constraint above.
