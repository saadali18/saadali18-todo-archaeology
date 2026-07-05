export async function mapWithConcurrency(items, concurrency, fn) {
    const results = new Array(items.length);
    let cursor = 0;
    async function worker() {
        for (;;) {
            const index = cursor++;
            if (index >= items.length)
                return;
            results[index] = await fn(items[index], index);
        }
    }
    const workerCount = Math.max(1, Math.min(concurrency, items.length));
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
}
