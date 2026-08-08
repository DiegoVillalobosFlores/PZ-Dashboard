// Prepended to every pcall.sh script (the plugin's JS session — and with it
// `storage` — resets on browser reload/reconnect, so helpers get redefined
// every call rather than relying on `storage` surviving between calls).
storage.tok = (name) => penpotUtils.findTokenByName(name);
storage.applyColor = (shape, name, prop = "fill") => shape.applyToken(storage.tok(name), [prop]);
storage.applyRadius = (shape, name) => {
  const t = storage.tok(name);
  shape.applyToken(t, ["borderRadiusTopLeft","borderRadiusTopRight","borderRadiusBottomRight","borderRadiusBottomLeft"]);
};
storage.applySpacing = (shape, name, props) => shape.applyToken(storage.tok(name), props);
storage.lucide = penpot.library.connected.find(l => l.name === "Lucide-icons");
storage.icon = (name) => storage.lucide.components.find(c => c.name === name);
storage.interFont = penpot.fonts.findByName("Inter");

storage.text = (str, { size = 14, weight = "400", color = "color.text.primary", align } = {}) => {
  const t = penpot.createText(str);
  t.growType = "auto-width";
  const variant = storage.interFont.variants.find(v => v.fontWeight === weight && v.fontStyle === "normal");
  storage.interFont.applyToText(t, variant);
  t.fontSize = size;
  if (align) t.align = align;
  if (color) storage.applyColor(t, color, "fill");
  return t;
};

storage.tintIcon = (inst, hex) => {
  const parts = penpotUtils.findShapes(s => Array.isArray(s.strokes) && s.strokes.length > 0, inst);
  for (const p of parts) p.strokes = p.strokes.map(s => ({ ...s, strokeColor: hex }));
};
storage.tintIconToken = (inst, tokenName) => {
  const t = storage.tok(tokenName);
  const parts = penpotUtils.findShapes(s => Array.isArray(s.strokes) && s.strokes.length > 0, inst);
  for (const p of parts) p.applyToken(t, ["strokeColor"]);
};
storage.iconInstance = (name, size, tokenName) => {
  const comp = storage.icon(name);
  const inst = comp.instance();
  // Penpot resize() only scales children whose constraints say "scale" —
  // default is fixed-position, so unset children stayed at native 24px
  // and got clipped by the now-smaller board. Set scale constraints first.
  const parts = penpotUtils.findShapes(() => true, inst);
  for (const p of parts) {
    try { p.constraintsHorizontal = "scale"; p.constraintsVertical = "scale"; } catch (e) {}
  }
  inst.resize(size, size);
  if (tokenName) storage.tintIconToken(inst, tokenName);
  else storage.tintIcon(inst, "#C1C2C5");
  return inst;
};

// Fixes an already-placed, already-broken icon instance in place (children
// still at native 24px scale) without needing to remove/recreate it.
storage.fixIconScale = (iconBoard) => {
  const size = iconBoard.width;
  if (Math.abs(size - 24) < 0.01) return; // already native, nothing to fix
  // Step 1: realign the frame back to the children's true native 24px
  // scale WITHOUT touching constraints yet (default fixed constraints
  // mean children don't move, so this just un-does the broken resize).
  iconBoard.resize(24, 24);
  // Step 2: now mark children scale-constrained and shrink for real.
  const parts = penpotUtils.findShapes(() => true, iconBoard);
  for (const p of parts) {
    try { p.constraintsHorizontal = "scale"; p.constraintsVertical = "scale"; } catch (e) {}
  }
  iconBoard.resize(size, size);
};

// An icon instance dropped into a flex container can end up with its glyph
// paths stranded at the position the board had *before* the layout moved
// it — the board reports the right x/y, but the children are still where
// they were dropped, so the icon draws somewhere else entirely (or not at
// all, once the board clips). Every Lucide instance carries a
// "base-background" rect that spans the board exactly, so the drift is
// measurable: shift every child by board-minus-base.
storage.reseatIcon = (iconBoard) => {
  const base = iconBoard.children.find((c) => c.name === "base-background");
  if (!base) return false;
  const dx = iconBoard.x - base.x;
  const dy = iconBoard.y - base.y;
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return false;
  for (const c of iconBoard.children) {
    c.x += dx;
    c.y += dy;
  }
  return true;
};

storage.reseatIconsIn = (root) => {
  let fixed = 0;
  for (const s of penpotUtils.findShapes((x) => x.type === "board" && x.children && x.children.some((c) => c.name === "base-background"), root)) {
    if (storage.reseatIcon(s)) fixed++;
  }
  return fixed;
};

storage.flexBoard = (name, dir = "row") => {
  const b = penpot.createBoard();
  b.name = name;
  const flex = b.addFlexLayout();
  flex.dir = dir;
  return b;
};

storage.libComp = (name) => penpot.library.local.components.find(c => c.name === name);

storage.tabBarItem = (state, iconName, label) => {
  const container = penpotUtils.findShape(s => s.name === "TabBarItem" && s.isVariantContainer && s.isVariantContainer());
  const variant = container.variants.variantComponents().find(v => v.variantProps.State === state);
  const inst = variant.instance();
  inst.detach();
  const oldIcon = inst.children.find(c => c.type === "board");
  const iconSize = oldIcon ? oldIcon.width : 22;
  if (oldIcon) oldIcon.remove();
  const newIcon = storage.iconInstance(iconName, iconSize, state === "Active" ? "color.accent.primary" : "color.text.secondary");
  inst.insertChild(0, newIcon);
  const textNode = inst.children.find(c => c.type === "text");
  if (textNode) textNode.characters = label;
  return inst;
};

storage.bottomTabBar = (activeTab) => {
  const tabs = [
    ["map-pin", "Map"],
    ["backpack", "Inventory"],
    ["grid-3x3", "Toolbar"],
    ["dumbbell", "Skills"],
  ];
  const bar = storage.flexBoard("BottomTabBar", "row");
  bar.flex.justifyContent = "space-around";
  bar.flex.alignItems = "center";
  bar.flex.horizontalPadding = 8;
  bar.flex.verticalPadding = 4;
  bar.flex.horizontalSizing = "fill";
  bar.flex.verticalSizing = "auto";
  storage.applyRadius(bar, "radius.md");
  storage.applyColor(bar, "color.bg.surface");
  const bTok = storage.tok("color.border.default");
  bar.strokes = [{ strokeColor: "#373A40", strokeOpacity: 1, strokeWidth: 1, strokeAlignment: "inner" }];
  bar.applyToken(bTok, ["strokeColor"]);
  for (const [icon, label] of tabs) {
    const item = storage.tabBarItem(label === activeTab ? "Active" : "Inactive", icon, label);
    bar.appendChild(item);
  }
  return bar;
};

storage.actionIcon = (iconName) => {
  const b = storage.flexBoard("ActionIcon", "row");
  b.resize(40, 40);
  b.flex.alignItems = "center";
  b.flex.justifyContent = "center";
  b.flex.horizontalSizing = "fix";
  b.flex.verticalSizing = "fix";
  storage.applyRadius(b, "radius.sm");
  storage.applyColor(b, "color.bg.surface");
  const bTok = storage.tok("color.border.default");
  b.strokes = [{ strokeColor: "#373A40", strokeOpacity: 1, strokeWidth: 1, strokeAlignment: "inner" }];
  b.applyToken(bTok, ["strokeColor"]);
  const icon = storage.iconInstance(iconName, 18, "color.text.primary");
  b.appendChild(icon);
  return b;
};

// ---- Version grid: every revision is a new row (Y = version, oldest on
// top), every screen type keeps the same column (X) across all rows.
// NEVER mutate an existing version's boards — duplicate the latest row,
// edit the duplicate, and that duplicate becomes the new latest row.
storage.versionColumns = [
  { key: "ayaneo-home", width: 1620 },
  { key: "ayaneo-popup", width: 480 },
  { key: "mobile-home", width: 390 },
  { key: "mobile-popup", width: 390 },
  { key: "ayaneo-health", width: 1620 },
  { key: "ayaneo-clothing-popup", width: 480 },
  { key: "mobile-health", width: 390 },
  { key: "mobile-clothing-popup", width: 390 },
  // Added in v8/v9 directly on canvas without a versionColumns entry — the
  // x-position sequence (each column starts at the previous column's
  // x+width+versionGap) was followed by hand, so backfilling these here is
  // just bookkeeping, not a reposition. Verified against actual canvas x's.
  { key: "ayaneo-firearm", width: 1620 },
  { key: "mobile-firearm", width: 390 },
  { key: "ayaneo-skills", width: 1620 },
  { key: "mobile-skills", width: 390 },
  // New in v11.
  { key: "ayaneo-inventory", width: 1620 },
  { key: "mobile-inventory", width: 390 },
];
storage.versionGap = 80;
storage.versionRowGap = 120;
storage.versionLabelHeight = 70;
// Every row reserves this much space on the left for a handover text panel
// (what changed, the user story, per-screen explanations) — see
// storage.addHandover. Screens start after it, not at x=0.
storage.handoverWidth = 560;
storage.handoverGap = 80;
storage.screenAreaX = () => storage.handoverWidth + storage.handoverGap;
storage.versionColumnX = (colIndex) => {
  let x = storage.screenAreaX();
  for (let i = 0; i < colIndex; i++) x += storage.versionColumns[i].width + storage.versionGap;
  return x;
};
storage.versionRowY = (versionNumber, rowHeight) => {
  let y = 0;
  for (let v = 1; v < versionNumber; v++) y += storage.versionLabelHeight + rowHeight + storage.versionRowGap;
  return y;
};

// Builds the handover panel for a version row: what changed since the
// previous version, the user story it serves, and a plain-English
// explanation of every screen in that row. Always author this fresh per
// version — it's narrative, never cloned. { whatChanged, userStory,
// screens: [{ name, explanation }] }
storage.addHandover = (version, rowHeight, { whatChanged, userStory, screens }) => {
  const y = storage.versionRowY(version, rowHeight) + storage.versionLabelHeight;
  const panel = storage.flexBoard("Handover", "column");
  penpot.root.appendChild(panel);
  panel.resize(storage.handoverWidth, 10);
  panel.flex.rowGap = 18;
  panel.flex.horizontalPadding = 24;
  panel.flex.verticalPadding = 24;
  panel.flex.horizontalSizing = "fix";
  panel.flex.verticalSizing = "auto";
  storage.applyRadius(panel, "radius.md");
  storage.applyColor(panel, "color.bg.surface");
  panel.strokes = [{ strokeColor: "#373A40", strokeOpacity: 1, strokeWidth: 1, strokeAlignment: "inner" }];
  panel.applyToken(storage.tok("color.border.default"), ["strokeColor"]);

  const section = (heading, body) => {
    const wrap = storage.flexBoard("Section", "column");
    wrap.flex.rowGap = 6;
    wrap.flex.horizontalSizing = "fill";
    wrap.flex.verticalSizing = "auto";
    wrap.fills = [];
    const h = storage.text(heading, { size: 12, weight: "700", color: "color.accent.primary" });
    h.textTransform = "uppercase";
    h.letterSpacing = 0.8;
    wrap.appendChild(h);
    const b = storage.text(body, { size: 14, weight: "400", color: "color.text.primary" });
    // resize() resets growType to "fixed" as a side effect — must set
    // auto-height AFTER resizing, not before, or it silently reverts.
    b.resize(storage.handoverWidth - 48, 10);
    b.growType = "auto-height";
    wrap.appendChild(b);
    return wrap;
  };

  panel.appendChild(section("What changed", whatChanged));
  panel.appendChild(section("User story", userStory));

  const screensWrap = storage.flexBoard("Section", "column");
  screensWrap.flex.rowGap = 6;
  screensWrap.flex.horizontalSizing = "fill";
  screensWrap.flex.verticalSizing = "auto";
  screensWrap.fills = [];
  const sh = storage.text("Screens", { size: 12, weight: "700", color: "color.accent.primary" });
  sh.textTransform = "uppercase";
  sh.letterSpacing = 0.8;
  screensWrap.appendChild(sh);
  for (const { name, explanation } of screens) {
    const row = storage.flexBoard("ScreenNote", "column");
    row.flex.rowGap = 2;
    row.flex.horizontalSizing = "fill";
    row.flex.verticalSizing = "auto";
    row.fills = [];
    const n = storage.text(name, { size: 13, weight: "600", color: "color.text.primary" });
    row.appendChild(n);
    const e = storage.text(explanation, { size: 13, weight: "400", color: "color.text.secondary" });
    e.resize(storage.handoverWidth - 48, 10);
    e.growType = "auto-height";
    row.appendChild(e);
    screensWrap.appendChild(row);
  }
  panel.appendChild(screensWrap);

  penpotUtils.setParentXY(panel, 0, y);
  return panel;
};

// Clones the 4 canonical boards from `fromVersion` into a new row at
// `toVersion`, keeping each screen in its same column. Returns the new
// board references, keyed the same as versionColumns, ready to edit.
// The source version's boards are left completely untouched.
storage.cloneVersionRow = (fromVersion, toVersion, rowHeight = 1080) => {
  // Columns introduced after v1 (health/clothing) predate this file having a
  // matcher for them, and their first boards were built without a "(vN)"
  // suffix at all — match either the versioned or bare name so cloning
  // still finds them, and see the rename fallback below for the bare case.
  const names = {
    // The "- Firearm Equipped" variants share the Home prefix, so the plain
    // home matchers must exclude them or findShape can return the variant.
    "ayaneo-home": (n) => n.includes("Screen / Home (HUD) - Ayaneo") && !n.includes("Firearm") && n.includes(`v${fromVersion}`),
    // WeaponSelect/SelectClothing were renamed Popup->Drawer at v3 — match
    // either name, but always require the version tag now that real v10
    // boards exist, or this silently grabs the bare, version-less v1 Popup
    // instead (bit us once: a v10->v11 clone pulled the ancient v1 design).
    "ayaneo-popup": (n) => (n.includes("Drawer / WeaponSelect (Ayaneo)") || n.includes("Popup / WeaponSelect (Ayaneo)")) && n.includes(`v${fromVersion}`),
    "mobile-home": (n) => n.includes("Screen / Home (HUD) - Mobile") && !n.includes("Firearm") && n.includes(`v${fromVersion}`),
    "mobile-popup": (n) => (n.includes("Drawer / WeaponSelect - Mobile") || n.includes("Popup / WeaponSelect - Mobile")) && n.includes(`v${fromVersion}`),
    "ayaneo-health": (n) => n.includes("Screen / Health (HUD) - Ayaneo") && n.includes(`v${fromVersion}`),
    "ayaneo-clothing-popup": (n) => (n.includes("Drawer / SelectClothing (Ayaneo)") || n.includes("Popup / SelectClothing (Ayaneo)")) && n.includes(`v${fromVersion}`),
    "mobile-health": (n) => n.includes("Screen / Health (HUD) - Mobile") && n.includes(`v${fromVersion}`),
    "mobile-clothing-popup": (n) => (n.includes("Drawer / SelectClothing - Mobile") || n.includes("Popup / SelectClothing - Mobile")) && n.includes(`v${fromVersion}`),
    "ayaneo-firearm": (n) => n.includes("Screen / Home (HUD) - Ayaneo") && n.includes("Firearm Equipped") && n.includes(`v${fromVersion}`),
    "mobile-firearm": (n) => n.includes("Screen / Home (HUD) - Mobile") && n.includes("Firearm Equipped") && n.includes(`v${fromVersion}`),
    "ayaneo-skills": (n) => n.includes("Screen / Skills (HUD) - Ayaneo") && n.includes(`v${fromVersion}`),
    "mobile-skills": (n) => n.includes("Screen / Skills (HUD) - Mobile") && n.includes(`v${fromVersion}`),
    "ayaneo-inventory": (n) => n.includes("Screen / Inventory (HUD) - Ayaneo") && n.includes(`v${fromVersion}`),
    "mobile-inventory": (n) => n.includes("Screen / Inventory (HUD) - Mobile") && n.includes(`v${fromVersion}`),
  };
  const y = storage.versionRowY(toVersion, rowHeight) + storage.versionLabelHeight;
  const result = {};
  storage.versionColumns.forEach((col, i) => {
    const matcher = names[col.key];
    if (!matcher) { result[col.key] = null; return; } // no source for this column yet (new in this version)
    const src = penpotUtils.findShape(s => matcher(s.name));
    if (!src) { result[col.key] = null; return; }
    const clone = src.clone();
    penpot.root.appendChild(clone);
    clone.x = storage.versionColumnX(i);
    clone.y = y;
    let newName = src.name.replace(`v${fromVersion}`, `v${toVersion}`);
    if (newName === src.name) newName = `${src.name} (v${toVersion})`; // bare name had no version tag to replace
    clone.name = newName;
    result[col.key] = clone;
  });
  const label = storage.text(`VERSION ${toVersion}`, { size: 24, weight: "700", color: "color.text.primary" });
  label.textTransform = "uppercase";
  label.letterSpacing = 1;
  penpot.root.appendChild(label);
  penpotUtils.setParentXY(label, 0, storage.versionRowY(toVersion, rowHeight));
  return result;
};

storage.screenShell = (name) => {
  const s = storage.flexBoard(name, "column");
  s.resize(390, 844);
  s.flex.rowGap = 12;
  s.flex.horizontalPadding = 16;
  s.flex.verticalPadding = 16;
  s.flex.horizontalSizing = "fix";
  s.flex.verticalSizing = "fix";
  storage.applyColor(s, "color.bg.app");
  return s;
};

// ---- Inventory (v11) + Skills-grid (v11) building blocks. Geometry below
// (inset 6, leg 20, thickness 2, color.accent.primary @0.85) was reverse
// -engineered from the actual BracketTick coordinates on the shipped
// EquipmentPanel (Health screen) so new panels match the established
// corner-bracket HUD motif exactly rather than approximating it.
storage.cornerBrackets = (x, y, w, h, { inset = 6, len = 20, thick = 2 } = {}) => {
  const rects = [
    // top-left
    [x + inset, y + inset, len, thick], [x + inset, y + inset, thick, len],
    // top-right
    [x + w - inset - len, y + inset, len, thick], [x + w - inset - thick, y + inset, thick, len],
    // bottom-left
    [x + inset, y + h - inset - thick, len, thick], [x + inset, y + h - inset - len, thick, len],
    // bottom-right
    [x + w - inset - len, y + h - inset - thick, len, thick], [x + w - inset - thick, y + h - inset - len, thick, len],
  ];
  return rects.map(([rx, ry, rw, rh]) => {
    const r = penpot.createRectangle();
    r.name = "BracketTick";
    r.resize(rw, rh);
    storage.applyColor(r, "color.accent.primary", "fill");
    r.fills = r.fills.map(f => ({ ...f, fillOpacity: 0.85 }));
    return { r, x: rx, y: ry };
  });
};

// A glass HUD panel: flex column, auto-height, dark solid bg (matches
// EquipmentPanel — this file's panels are opaque, not translucent, despite
// the "glass" name; only the ScanGrid/MapBackground layer behind them is
// translucent), centered uppercase header, corner brackets added last (so
// they render above content) once the panel's final size is known.
storage.panelChrome = (name, width, headerLabel) => {
  const panel = storage.flexBoard(name, "column");
  panel.name = name;
  panel.flex.rowGap = 14;
  panel.flex.horizontalPadding = 24;
  panel.flex.verticalPadding = 20;
  panel.flex.horizontalSizing = "fix";
  panel.flex.verticalSizing = "auto";
  panel.flex.alignItems = "center";
  panel.resize(width, 10);
  storage.applyRadius(panel, "radius.sm");
  storage.applyColor(panel, "color.bg.app");
  if (headerLabel) {
    const h = storage.text(headerLabel, { size: 18, weight: "700", color: "color.text.primary" });
    h.textTransform = "uppercase";
    h.letterSpacing = 1;
    panel.appendChild(h);
  }
  return panel;
};

// Call once the panel has its final w/h (i.e. after appending to a parent
// and letting flex settle) — adds the 8 corner-bracket rects as the panel's
// last children. NOTE: penpotUtils.setParentXY(shape, x, y) sets shape's
// absolute position to shape.parent.x + x, shape.parent.y + y — i.e. x/y
// are LOCAL to the immediate parent, not absolute canvas coords (verified
// empirically; easy to get backwards since it "looks" absolute whenever
// the parent happens to be penpot.root, whose own x/y is 0,0). Ticks are
// appended straight to `panel`, so we compute corners in panel-local space
// (origin 0,0), not panel.x/panel.y.
storage.finishPanelChrome = async (panel) => {
  await new Promise(r => setTimeout(r, 200));
  const ticks = storage.cornerBrackets(0, 0, panel.width, panel.height);
  for (const { r, x, y } of ticks) {
    panel.appendChild(r);
    penpotUtils.setParentXY(r, x, y);
  }
};

// Small square icon-only chip used for category filter rows (Inventory)
// and skill-group filter rows (Skills) — same active/inactive treatment as
// RailNavButton (orange fill + white icon when active, dark fill + gray
// icon otherwise) so the new filter row reads as the same control family.
storage.chip = (iconName, active, size = 36) => {
  const b = storage.flexBoard("Chip", "row");
  b.resize(size, size);
  b.flex.alignItems = "center";
  b.flex.justifyContent = "center";
  b.flex.horizontalSizing = "fix";
  b.flex.verticalSizing = "fix";
  storage.applyRadius(b, "radius.sm");
  if (active) {
    b.fills = [{ fillColor: "#f76707", fillOpacity: 0.85 }];
  } else {
    storage.applyColor(b, "color.bg.surface");
  }
  const icon = storage.iconInstance(iconName, Math.round(size * 0.5), active ? null : "color.text.secondary");
  if (active) storage.tintIcon(icon, "#ffffff");
  b.appendChild(icon);
  return b;
};

// Category chip + its label stacked underneath, for the "icons at the top
// for the categories" filter rows on both Skills and Inventory — shared so
// both screens read as the same control.
storage.categoryChipLabeled = (iconName, label, active) => {
  const wrap = storage.flexBoard("CategoryChipLabeled", "column");
  wrap.flex.alignItems = "center";
  wrap.flex.rowGap = 4;
  wrap.flex.horizontalSizing = "auto";
  wrap.flex.verticalSizing = "auto";
  wrap.fills = [];
  wrap.appendChild(storage.chip(iconName, active, 36));
  const t = storage.text(label, { size: 9, weight: "600", color: active ? "color.accent.primary" : "color.text.secondary" });
  t.textTransform = "uppercase";
  t.letterSpacing = 0.4;
  wrap.appendChild(t);
  return wrap;
};

// Tiny rounded count badge (KeyBadge's proportions/radius, but tinted
// orange so an item's stack count pops against a grid of icons).
storage.countBadge = (n) => {
  const b = storage.flexBoard("CountBadge", "row");
  b.resize(18, 16);
  b.flex.alignItems = "center";
  b.flex.justifyContent = "center";
  b.flex.horizontalSizing = "fix";
  b.flex.verticalSizing = "fix";
  storage.applyRadius(b, "radius.sm");
  b.fills = [{ fillColor: "#f76707", fillOpacity: 0.95 }];
  const t = storage.text(`×${n}`, { size: 10, weight: "700", color: null });
  t.fills = [{ fillColor: "#ffffff", fillOpacity: 1 }];
  b.appendChild(t);
  return b;
};

// One item in a categorized grid: icon, name (2-line clamp via fixed
// height), weight, optional stack-count badge overlaid top-right.
storage.itemTile = (iconName, name, { count, weight, width = 88, height = 104 } = {}) => {
  const tile = storage.flexBoard("ItemTile", "column");
  tile.resize(width, height);
  tile.flex.alignItems = "center";
  tile.flex.rowGap = 4;
  tile.flex.horizontalPadding = 8;
  tile.flex.verticalPadding = 10;
  tile.flex.horizontalSizing = "fix";
  tile.flex.verticalSizing = "fix";
  storage.applyRadius(tile, "radius.sm");
  storage.applyColor(tile, "color.bg.surface");
  const bTok = storage.tok("color.border.default");
  tile.strokes = [{ strokeColor: "#373A40", strokeOpacity: 1, strokeWidth: 1, strokeAlignment: "inner" }];
  tile.applyToken(bTok, ["strokeColor"]);
  const icon = storage.iconInstance(iconName, 28, "color.text.primary");
  tile.appendChild(icon);
  const nameT = storage.text(name, { size: 11, weight: "600", color: "color.text.primary", align: "center" });
  nameT.resize(width - 16, 10);
  nameT.growType = "auto-height";
  tile.appendChild(nameT);
  if (weight != null) {
    const wT = storage.text(`${weight}kg`, { size: 10, weight: "400", color: "color.text.secondary", align: "center" });
    tile.appendChild(wT);
  }
  if (count && count > 1) {
    const badge = storage.countBadge(count);
    tile.appendChild(badge);
  }
  return tile;
};

// Move the count badge to float over the tile's top-right corner instead
// of sitting inline in the column flow. Badge's parent is the tile itself,
// so coords are tile-local (see setParentXY note on storage.finishPanelChrome).
storage.floatCountBadge = (tile) => {
  const badge = tile.children.find(c => c.name === "CountBadge");
  if (!badge) return;
  penpotUtils.setParentXY(badge, tile.width - 20, -4);
};

// A flex-wrap grid area that lays out itemTiles (built via storage.itemTile)
// at a fixed width, wrapping to multiple rows — Penpot's flex `wrap` mode
// verified to auto-grow the container's height per-row.
storage.tileGrid = (width) => {
  const grid = storage.flexBoard("TileGrid", "row");
  grid.flex.wrap = "wrap";
  grid.flex.rowGap = 10;
  grid.flex.columnGap = 10;
  grid.flex.horizontalSizing = "fix";
  grid.flex.verticalSizing = "auto";
  grid.resize(width, 10);
  grid.fills = [];
  return grid;
};

// Category section inside a categorized grid: small muted label + its
// own tileGrid of items.
storage.categorySection = (label, width) => {
  const wrap = storage.flexBoard("CategorySection", "column");
  wrap.flex.rowGap = 8;
  wrap.flex.horizontalSizing = "fix";
  wrap.flex.verticalSizing = "auto";
  wrap.resize(width, 10);
  wrap.fills = [];
  const t = storage.text(label, { size: 11, weight: "700", color: "color.accent.primary" });
  t.textTransform = "uppercase";
  t.letterSpacing = 0.8;
  wrap.appendChild(t);
  const grid = storage.tileGrid(width);
  wrap.appendChild(grid);
  return { wrap, grid };
};

// Nearby-container list card: kind icon, name, item count + weight, lock
// badge, selected/active state (orange left accent + tinted bg) matching
// the same active-state color language as chips/nav.
storage.containerCard = (kindIcon, name, { itemCount, weight, locked, active, width = 340 } = {}) => {
  const card = storage.flexBoard("ContainerCard", "row");
  card.resize(width, 10);
  card.flex.alignItems = "center";
  card.flex.columnGap = 12;
  card.flex.horizontalPadding = 14;
  card.flex.verticalPadding = 12;
  card.flex.horizontalSizing = "fix";
  card.flex.verticalSizing = "auto";
  storage.applyRadius(card, "radius.sm");
  storage.applyColor(card, active ? "color.accent.primary" : "color.bg.surface", "fill");
  if (active) card.fills = card.fills.map(f => ({ ...f, fillOpacity: 0.18 }));
  const bTok = storage.tok("color.border.default");
  card.strokes = [{ strokeColor: active ? "#f76707" : "#373A40", strokeOpacity: 1, strokeWidth: active ? 2 : 1, strokeAlignment: "inner" }];
  if (!active) card.applyToken(bTok, ["strokeColor"]);
  const icon = storage.iconInstance(kindIcon, 22, active ? "color.accent.primary" : "color.text.secondary");
  card.appendChild(icon);
  const textCol = storage.flexBoard("TextCol", "column");
  textCol.flex.rowGap = 2;
  textCol.flex.horizontalSizing = "fill";
  textCol.flex.verticalSizing = "auto";
  textCol.fills = [];
  const nameT = storage.text(name, { size: 13, weight: "600", color: "color.text.primary" });
  textCol.appendChild(nameT);
  const subT = storage.text(`${itemCount} items · ${weight}kg`, { size: 11, weight: "400", color: "color.text.secondary" });
  textCol.appendChild(subT);
  card.appendChild(textCol);
  if (locked) {
    const lockIcon = storage.iconInstance("lock", 16, "color.text.secondary");
    card.appendChild(lockIcon);
  }
  return card;
};

// Compact grid tile for a single skill: icon, name, "N/10" readout, and
// the same 10-square segmented meter used in v10's SkillRow (kept because
// it's the exact PZ-native look the v10 handover was written to fix — the
// grid only changes the outer layout, not the meter itself).
storage.skillTile = (iconName, name, level, { width = 150 } = {}) => {
  const tile = storage.flexBoard("SkillTile", "column");
  tile.resize(width, 10);
  tile.flex.rowGap = 6;
  tile.flex.horizontalPadding = 10;
  tile.flex.verticalPadding = 10;
  tile.flex.horizontalSizing = "fix";
  tile.flex.verticalSizing = "auto";
  storage.applyRadius(tile, "radius.sm");
  storage.applyColor(tile, "color.bg.surface");
  const bTok = storage.tok("color.border.default");
  tile.strokes = [{ strokeColor: "#373A40", strokeOpacity: 1, strokeWidth: 1, strokeAlignment: "inner" }];
  tile.applyToken(bTok, ["strokeColor"]);

  const top = storage.flexBoard("Top", "row");
  top.flex.alignItems = "center";
  top.flex.columnGap = 6;
  top.flex.horizontalSizing = "fill";
  top.flex.verticalSizing = "auto";
  top.fills = [];
  const icon = storage.iconInstance(iconName, 16, "color.text.secondary");
  top.appendChild(icon);
  const nameT = storage.text(name, { size: 12, weight: "600", color: "color.text.primary" });
  nameT.resize(width - 20 - 22 - 30, 10);
  nameT.growType = "auto-width";
  top.appendChild(nameT);
  const levelT = storage.text(`${level}/10`, { size: 12, weight: "700", color: null });
  levelT.fills = [{ fillColor: "#f76707", fillOpacity: 1 }];
  top.appendChild(levelT);
  tile.appendChild(top);

  const meter = storage.flexBoard("SkillMeter", "row");
  meter.flex.columnGap = 3;
  meter.flex.horizontalSizing = "fill";
  meter.flex.verticalSizing = "fix";
  meter.resize(width - 20, 10);
  meter.fills = [];
  for (let i = 0; i < 10; i++) {
    const sq = penpot.createRectangle();
    sq.name = "MeterSquare";
    sq.resize(10, 10);
    sq.fills = i < level
      ? [{ fillColor: "#f76707", fillOpacity: 1 }]
      : [{ fillColor: "#1a1b1e", fillOpacity: 1 }];
    meter.appendChild(sq);
  }
  tile.appendChild(meter);
  return tile;
};

// ---- v12: edge-anchored mobile chrome. The status bar and hotbar stop
// being floating inset pills and become full-bleed bars pinned to the
// screen edges (top:0/left:0 and bottom:0/left:0, no side margins), still
// translucent so the map reads through them. Penpot's "background-blur"
// blur type is the real backdrop blur (layer-blur would smear the bar's
// own icons/text instead), so that's what carries the frosted look.
storage.mobileBarWidth = 390;
storage.statusBarHeight = 56;
storage.hotbarDockHeight = 72;

// The 1px accent rule that separates an edge-anchored bar from the map —
// replaces the floating panels' full outline, which reads wrong once a bar
// runs edge to edge.
storage.barRule = (width) => {
  const r = penpot.createRectangle();
  r.name = "BarRule";
  r.resize(width, 1);
  r.fills = [{ fillColor: "#f76707", fillOpacity: 0.4 }];
  return r;
};

// A plain (non-flex) full-bleed bar board: children are positioned by hand
// so the bar can pin content to its left and right edges independently.
storage.edgeBar = (name, width, height, { shadowY = 6 } = {}) => {
  const bar = penpot.createBoard();
  bar.name = name;
  bar.resize(width, height);
  bar.borderRadius = 0;
  storage.applyColor(bar, "color.bg.app", "fill");
  bar.fills = bar.fills.map((f) => ({ ...f, fillOpacity: 0.6 }));
  bar.blur = { type: "background-blur", value: 14, hidden: false };
  bar.strokes = [];
  bar.shadows = [{ style: "drop-shadow", offsetX: 0, offsetY: shadowY, blur: 20, spread: 0, hidden: false, color: { color: "#000000", opacity: 0.45 } }];
  return bar;
};

// QuickIcon is a centring flex board wrapping a fixed-size icon instance,
// so resizing the chip re-centres the glyph on its own — no scale
// constraints needed here (unlike a bare icon instance).
storage.resizeNavChip = (chip, size) => {
  chip.resize(size, size);
  chip.flex.horizontalSizing = "fix";
  chip.flex.verticalSizing = "fix";
};

// Converts one mobile screen board from floating status pill + floating
// hotbar to the two edge-anchored bars. Idempotent enough to re-run: it
// looks the children up by name and bails if the bars already exist.
storage.dockMobileBars = async (screen) => {
  if (screen.children.some((c) => c.name === "StatusBar")) return;
  const W = storage.mobileBarWidth;
  const cluster = screen.children.find((c) => c.name === "ConditionCluster");
  const icons = screen.children.filter((c) => c.name === "QuickIcon");
  const hotbar = screen.children.find((c) => c.name === "FloatingHotbar");

  const statusBar = storage.edgeBar("StatusBar", W, storage.statusBarHeight, { shadowY: 6 });
  screen.appendChild(statusBar);
  penpotUtils.setParentXY(statusBar, 0, 0);

  // The pill's own surface and corner brackets are redundant once the bar
  // itself is the surface — strip them so the vitals read as bar content.
  statusBar.appendChild(cluster);
  cluster.fills = [];
  cluster.strokes = [];
  cluster.shadows = [];
  for (const tick of cluster.children.filter((c) => c.name === "BracketTick")) tick.remove();

  // 390px leaves no room for the vitals pill's own padding once both blocks
  // are pinned to opposite edges — at v11's spacing the last mini-vital sat
  // underneath the first nav chip. The bar supplies the outer padding now,
  // so the pill drops its own and the chips normalise to 40px.
  cluster.flex.horizontalPadding = 0;
  cluster.flex.columnGap = 8;
  const sorted = icons.slice().sort((a, b) => a.x - b.x);
  for (const icon of sorted) {
    if (icon.width !== 40) storage.resizeNavChip(icon, 40);
  }
  await new Promise((r) => setTimeout(r, 200));
  penpotUtils.setParentXY(cluster, 12, Math.round((storage.statusBarHeight - cluster.height) / 2));

  // Nav buttons keep their own chip treatment (orange when active) and
  // right-align inside the bar.
  const size = 40;
  const gap = 8;
  sorted.forEach((icon, i) => {
    statusBar.appendChild(icon);
    const fromRight = sorted.length - 1 - i;
    penpotUtils.setParentXY(icon, W - 12 - size - fromRight * (size + gap), Math.round((storage.statusBarHeight - size) / 2));
  });

  const statusRule = storage.barRule(W);
  statusBar.appendChild(statusRule);
  penpotUtils.setParentXY(statusRule, 0, storage.statusBarHeight - 1);

  const dock = storage.edgeBar("HotbarDock", W, storage.hotbarDockHeight, { shadowY: -6 });
  screen.appendChild(dock);
  penpotUtils.setParentXY(dock, 0, screen.height - storage.hotbarDockHeight);

  // The slot row survives as-is; it just loses the chrome that made it
  // look like a floating panel and gets centred inside the dock.
  dock.appendChild(hotbar);
  hotbar.fills = [];
  hotbar.strokes = [];
  hotbar.shadows = [];
  hotbar.borderRadius = 0;
  await new Promise((r) => setTimeout(r, 120));
  penpotUtils.setParentXY(hotbar, Math.round((W - hotbar.width) / 2), Math.round((storage.hotbarDockHeight - hotbar.height) / 2));

  const dockRule = storage.barRule(W);
  dock.appendChild(dockRule);
  penpotUtils.setParentXY(dockRule, 0, 0);
};

// ---- v12: the selection drawers adopt the Inventory screen's tile
// language. Same recipe as storage.itemTile (bg.surface + hairline border +
// radius.sm + 28px icon + mixed-case name + secondary weight line), with
// the condition dot moved inline next to the weight — Penpot lays every
// flex child in flow, so an "absolutely" floated corner marker doesn't
// survive (the Inventory count badges ended up inline for the same reason).
storage.selectableTile = (item, width, height) => {
  const tile = storage.flexBoard("ItemTile", "column");
  tile.resize(width, height);
  tile.flex.alignItems = "center";
  tile.flex.rowGap = 5;
  tile.flex.horizontalPadding = 8;
  tile.flex.verticalPadding = 12;
  tile.flex.horizontalSizing = "fix";
  tile.flex.verticalSizing = "fix";
  storage.applyRadius(tile, "radius.sm");
  if (item.equipped) {
    // Same active treatment the Inventory screen's selected container card
    // was reaching for: accent wash + 2px accent border. Set as a raw fill,
    // not applyToken-then-lower-the-opacity — the token binding re-resolves
    // to full opacity, which is why those cards ship as solid orange with
    // near-illegible text.
    tile.fills = [{ fillColor: "#f76707", fillOpacity: 0.18 }];
    tile.strokes = [{ strokeColor: "#f76707", strokeOpacity: 1, strokeWidth: 2, strokeAlignment: "inner" }];
  } else {
    storage.applyColor(tile, "color.bg.surface");
    tile.strokes = [{ strokeColor: "#373A40", strokeOpacity: 1, strokeWidth: 1, strokeAlignment: "inner" }];
    tile.applyToken(storage.tok("color.border.default"), ["strokeColor"]);
  }

  const icon = storage.iconInstance(item.icon, 28, item.equipped ? "color.accent.primary" : "color.text.primary");
  tile.appendChild(icon);

  const nameT = storage.text(item.name, { size: 11, weight: "600", color: "color.text.primary", align: "center" });
  nameT.resize(width - 16, 10);
  nameT.growType = "auto-height";
  tile.appendChild(nameT);

  const meta = storage.flexBoard("TileMeta", "row");
  meta.flex.alignItems = "center";
  meta.flex.columnGap = 5;
  meta.flex.horizontalSizing = "auto";
  meta.flex.verticalSizing = "auto";
  meta.fills = [];
  const dot = penpot.createEllipse();
  dot.name = "ConditionDot";
  dot.resize(6, 6);
  dot.fills = [{ fillColor: item.dot, fillOpacity: 1 }];
  meta.appendChild(dot);
  meta.appendChild(storage.text(`${item.weight}kg`, { size: 10, weight: "400", color: "color.text.secondary" }));
  tile.appendChild(meta);
  return tile;
};

// Rebuilds a WeaponSelect/SelectClothing drawer body in the Inventory
// screen's idiom: app-dark surface (so tiles read as surfaces on top of it,
// exactly as on the Inventory screen), panel-style header + count subtitle,
// a labelled category chip row, orange section headings and a wrapping
// tile grid. The board's corner brackets, shadow and close control are
// left alone — those already match.
storage.rebuildSelectDrawer = async (board, spec) => {
  const pad = spec.pad;
  const contentW = board.width - pad * 2;

  storage.applyColor(board, "color.bg.app", "fill");

  const header = penpotUtils.findShape((s) => s.name === "Header", board);
  const title = header.children.find((c) => c.type === "text");
  title.fontSize = spec.titleSize;
  title.letterSpacing = 1;
  storage.applyColor(title, "color.text.primary", "fill");

  const oldGrid = penpotUtils.findShape((s) => s.name === "ItemGrid", board);
  const oldSub = penpotUtils.findShape((s) => s.name === "DrawerSubtitle", board);
  const oldChips = penpotUtils.findShape((s) => s.name === "CategoryChipRow", board);
  if (oldGrid) oldGrid.remove();
  if (oldSub) oldSub.remove();
  if (oldChips) oldChips.remove();

  let y = pad + header.height + 6;

  const sub = storage.text(spec.subtitle, { size: 12, weight: "400", color: "color.text.secondary" });
  sub.name = "DrawerSubtitle";
  board.appendChild(sub);
  penpotUtils.setParentXY(sub, pad, y);
  y += 26;

  const chipRow = storage.flexBoard("CategoryChipRow", "row");
  chipRow.flex.columnGap = 10;
  chipRow.flex.alignItems = "start";
  chipRow.flex.horizontalSizing = "auto";
  chipRow.flex.verticalSizing = "auto";
  chipRow.fills = [];
  for (const [icon, label, active] of spec.chips) chipRow.appendChild(storage.categoryChipLabeled(icon, label, active));
  board.appendChild(chipRow);
  await new Promise((r) => setTimeout(r, 150));
  penpotUtils.setParentXY(chipRow, pad, y);
  y += chipRow.height + 22;

  const grid = storage.flexBoard("ItemGrid", "column");
  grid.flex.rowGap = 20;
  grid.flex.horizontalSizing = "fix";
  grid.flex.verticalSizing = "auto";
  grid.resize(contentW, 10);
  grid.fills = [];
  board.appendChild(grid);

  for (const category of spec.categories) {
    const { wrap, grid: tiles } = storage.categorySection(category.label, contentW);
    grid.appendChild(wrap);
    for (const item of category.items) tiles.appendChild(storage.selectableTile(item, spec.tileW, spec.tileH));
  }

  await new Promise((r) => setTimeout(r, 400));
  penpotUtils.setParentXY(grid, pad, y);
  await new Promise((r) => setTimeout(r, 400));
  return storage.reseatIconsIn(board);
};
