export function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}
export function durationMinutes(start, end) {
    return Math.round((end.getTime() - start.getTime()) / 60_000);
}
export function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6;
}
export function formatSlot(slot, locale = "en-US") {
    const day = new Intl.DateTimeFormat(locale, {
        weekday: "long",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(slot.start);
    const end = new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit"
    }).format(slot.end);
    return `${day} - ${end}`;
}
