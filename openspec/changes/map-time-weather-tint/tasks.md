## 1. Collect the climate values

- [ ] 1.1 In `PZDashboard.Collectors.status`, add `dayLight` from `climate:getDayLightStrength()` defaulting to `1`, and `precipitation`, `snow`, `fogIntensity` from `getPrecipitationIntensity()`, `getSnowStrength()`, `getFogIntensity()` defaulting to `0`, each wrapped in `safe` with a `status.<field>` label.
- [ ] 1.2 Deploy with `bun scripts/deploy-mod.ts`, reload Lua, then grep `console.txt` for `[PZDashboard] status.` `failed:` lines and confirm none of the four appear.
- [ ] 1.3 Record the observed values from `PZDashboard_status.json` at noon, at dusk, at full night, during rain and during fog, and confirm the actual ranges before tuning the curve in 2.2. Do not assume 0..1 on the basis of the field names.

## 2. Tint function

- [ ] 2.1 Add the four fields as optional numbers on `StatusSnapshot` in `packages/web/lib/liveTypes.ts`.
- [ ] 2.2 Add `packages/web/lib/mapTint.ts` exporting a pure function from a status snapshot to a CSS colour string: clamp each input, combine darkness, weather and fog contributions, shift the weather contribution paler when `snow > 0`, and cap total alpha at a named legibility constant.
- [ ] 2.3 Return fully transparent when the snapshot is missing, when all four fields are absent, or when the values describe clear daylight.
- [ ] 2.4 Add `packages/web/lib/mapTint.test.ts` covering: clear noon is transparent; full night is at the cap and no darker; rain at noon greys without exceeding the cap; snow reads paler than the same precipitation without snow; a snapshot with no climate fields is transparent; one missing field does not discard the others; out-of-range and non-finite inputs are clamped.

## 3. Render

- [ ] 3.1 Add `useMapTint` to `packages/web/lib/settings.ts`, defaulting to `true`, alongside `useFogOfWar`.
- [ ] 3.2 Add its row to `packages/web/screens/SettingsScreen.tsx` next to fog of war.
- [ ] 3.3 In `packages/web/components/MapCanvas.tsx`, subscribe to the status category for the climate values and render an absolutely positioned overlay `div` immediately after `</svg>` and before the recenter button, with `inset: 0`, `pointerEvents: 'none'`, the computed background, and a background transition of about one second.
- [ ] 3.4 Render no overlay at all when the setting is off.

## 4. Verify

- [ ] 4.1 In a live game with fog of war on, watch a full dusk-to-night transition and confirm the map darkens smoothly and stays readable: streets, place labels, the player marker and an active route all still distinguishable at maximum tint.
- [ ] 4.2 Confirm rain, snow and fog each visibly change the tint and that snow reads differently from rain.
- [ ] 4.3 Confirm the pill, nav rail, hotbar, map buttons and an open drawer are untinted, and that panning, zooming and double-tap-to-route still work with the overlay present.
- [ ] 4.4 Confirm the toggle takes effect immediately and survives a reload.
- [ ] 4.5 Confirm a dashboard running against a mod without the new fields renders untinted.
- [ ] 4.6 Check the map still eases the player marker smoothly while tinted at 1620x1080 and 390x844, with no new frame cost from the overlay.
