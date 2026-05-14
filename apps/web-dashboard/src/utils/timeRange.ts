export function clampRangeToNow(
    start: number,
    end: number,
    now = Date.now(),
) {
    const clampedStart = Math.min(start, now);
    const clampedEnd = Math.min(end, now);

    if (clampedStart === clampedEnd) {
        return { start: clampedStart - 1, end: clampedEnd };
    }

    if (clampedStart < clampedEnd) {
        return { start: clampedStart, end: clampedEnd };
    }

    return { start: clampedEnd, end: clampedEnd };
}

export function getDefaultHistoricalTimeWindow(
    challengeStart: number,
    challengeEnd: number,
    now = Date.now(),
) {
    const end = Math.min(challengeEnd, now);
    const start = Math.min(challengeStart, end);

    return { start, end };
}
