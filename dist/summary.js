export function buildSummary(items, shallowClone) {
    const byTagMap = new Map();
    const byAuthorMap = new Map();
    let ageSum = 0;
    let ageCount = 0;
    let oldest = null;
    for (const item of items) {
        byTagMap.set(item.tag, (byTagMap.get(item.tag) ?? 0) + 1);
        byAuthorMap.set(item.author, (byAuthorMap.get(item.author) ?? 0) + 1);
        if (item.ageDays !== null) {
            ageSum += item.ageDays;
            ageCount++;
            if (oldest === null || item.ageDays > oldest)
                oldest = item.ageDays;
        }
    }
    const byTag = [...byTagMap.entries()]
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count);
    const byAuthor = [...byAuthorMap.entries()]
        .map(([author, count]) => ({ author, count }))
        .sort((a, b) => b.count - a.count);
    return {
        total: items.length,
        byTag,
        byAuthor,
        oldestAgeDays: oldest,
        averageAgeDays: ageCount > 0 ? Math.round(ageSum / ageCount) : null,
        topAuthor: byAuthor.length > 0 ? byAuthor[0] : null,
        shallowClone,
    };
}
