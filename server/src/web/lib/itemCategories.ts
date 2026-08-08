export interface CategorizedItem {
  displayCategory?: string;
  categoryLabel?: string;
}

export interface ItemCategoryGroup<T> {
  key: string;
  label: string;
  items: T[];
}

const OTHER_KEY = '';
const OTHER_LABEL = 'Other';

export function itemCategoryKey(item: CategorizedItem): string {
  return item.displayCategory || OTHER_KEY;
}

export function itemCategoryLabel(item: CategorizedItem): string {
  return item.categoryLabel || item.displayCategory || OTHER_LABEL;
}

export function groupByItemCategory<T extends CategorizedItem>(items: T[]): ItemCategoryGroup<T>[] {
  const groups = new Map<string, ItemCategoryGroup<T>>();

  for (const item of items) {
    const key = itemCategoryKey(item);
    let group = groups.get(key);
    if (!group) {
      group = { key, label: itemCategoryLabel(item), items: [] };
      groups.set(key, group);
    }
    group.items.push(item);
  }

  return [...groups.values()].sort((a, b) => {
    if (a.key === OTHER_KEY) return 1;
    if (b.key === OTHER_KEY) return -1;
    return a.label.localeCompare(b.label);
  });
}
