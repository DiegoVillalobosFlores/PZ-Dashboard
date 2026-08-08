// Best-effort icon guess for arbitrary inventory/toolbar item names — the
// mod only sends display names and PZ fully-qualified types, not an icon
// id, so this is a keyword heuristic rather than a lookup table.
export function iconForItem(name: string, type?: string): string {
  const n = `${name} ${type ?? ''}`.toLowerCase();
  if (n.includes('axe') || n.includes('hatchet')) return 'axe';
  if (n.includes('wrench')) return 'wrench';
  if (n.includes('hammer')) return 'hammer';
  if (n.includes('bag') || n.includes('pack')) return 'backpack';
  if (n.includes('bottle') || n.includes('water')) return 'droplet';
  if (n.includes('shirt') || n.includes('jacket') || n.includes('hoodie') || n.includes('bikini')) return 'shirt';
  if (n.includes('glasses')) return 'glasses';
  if (n.includes('shoe') || n.includes('sneaker') || n.includes('boot')) return 'footprints';
  if (n.includes('flashlight') || n.includes('torch') || n.includes('lamp')) return 'flashlight';
  if (n.includes('hat') || n.includes('helmet')) return 'hard-hat';
  if (n.includes('glove') || n.includes('mitt')) return 'hand';
  return 'box';
}
