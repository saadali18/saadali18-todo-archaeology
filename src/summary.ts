import type { Item, Summary, AuthorCount, TagCount } from "./types.js";

export function buildSummary(items: Item[], shallowClone: boolean): Summary {
  const byTagMap = new Map<string, number>();
  const byAuthorMap = new Map<string, number>();
  let ageSum = 0;
  let ageCount = 0;
  let oldest: number | null = null;

  for (const item of items) {
    byTagMap.set(item.tag, (byTagMap.get(item.tag) ?? 0) + 1);
    byAuthorMap.set(item.author, (byAuthorMap.get(item.author) ?? 0) + 1);
    if (item.ageDays !== null) {
      ageSum += item.ageDays;
      ageCount++;
      if (oldest === null || item.ageDays > oldest) oldest = item.ageDays;
    }
  }

  const byTag: TagCount[] = [...byTagMap.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
  const byAuthor: AuthorCount[] = [...byAuthorMap.entries()]
    .map(([author, count]) => ({ author, count }))
    .sort((a, b) => b.count - a.count);

  return {
    total: items.length,
    byTag,
    byAuthor,
    oldestAgeDays: oldest,
    averageAgeDays: ageCount > 0 ? Math.round(ageSum / ageCount) : null,
    topAuthor: byAuthor.length > 0 ? (byAuthor[0] as AuthorCount) : null,
    shallowClone,
  };
}
