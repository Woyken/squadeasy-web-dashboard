import { type TimeUnit, _adapters } from "chart.js";
const dayFmt = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
});
const hourFmt = new Intl.DateTimeFormat(undefined, { hour: "2-digit" });
const millisecondFmt = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
});
const minuteFmt = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
});
const monthFmt = new Intl.DateTimeFormat(undefined, {
    month: "short",
    year: "numeric",
});
const yearFmt = new Intl.DateTimeFormat(undefined, { year: "numeric" });
const secondFmt = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
});
const weekFmt = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
});
const FORMATS: { [key in TimeUnit]: (date: Date | number) => string } = {
    day: (d) => dayFmt.format(d),
    hour: (d) => hourFmt.format(d),
    millisecond: (d) => millisecondFmt.format(d),
    minute: (d) => minuteFmt.format(d),
    month: (d) => monthFmt.format(d),
    year: (d) => yearFmt.format(d),
    second: (d) => secondFmt.format(d),
    week: (d) => weekFmt.format(d),
    quarter: (d) =>
        `Q${Math.floor(new Date(d).getMonth() / 3) + 1} - ${yearFmt.format(d)}`,
};

const isKnownFormat = (format: string): format is keyof typeof FORMATS =>
    format in FORMATS;

const adapter: Parameters<typeof _adapters._date.override>[0] = {
    formats: function () {
        return (Object.keys(FORMATS) as (keyof typeof FORMATS)[]).reduce(
            (acc, curr) => {
                acc[curr] = curr;
                return acc;
            },
            {} as Record<string, string>,
        );
    },

    init: function () {
        // noop
    },

    parse: function (value) {
        if (typeof value !== "string" && typeof value !== "number") return null;
        if (typeof value === "number") return value;
        const v = new Date(value);
        const time = v.getTime();
        return isNaN(time) ? null : time;
    },

    format: function (time, format) {
        if (isKnownFormat(format)) return FORMATS[format](time);
        if (format == null) return new Date(time).toLocaleString();
        else {
            return new Date(time).toISOString();
        }
    },

    add: function (time, amount, unit) {
        let multiplier: number | undefined = undefined;
        switch (unit) {
            case "millisecond":
                multiplier = 1;
                break;
            case "second":
                multiplier = 1000;
                break;
            case "minute":
                multiplier = 60 * 1000;
                break;
            case "hour":
                multiplier = 60 * 60 * 1000;
            case "day":
                multiplier = 24 * 60 * 60 * 1000;
                break;
            case "week":
                multiplier = 7 * 24 * 60 * 60 * 1000;
                break;
            case "month": {
                const date = new Date(time);
                return date.setMonth(date.getMonth() + amount);
            }
            case "quarter": {
                const date = new Date(time);
                return date.setMonth(date.getMonth() + 3 * amount);
            }
            case "year": {
                const date = new Date(time);
                return date.setFullYear(date.getFullYear() + amount);
            }
            default:
                throw new Error("Unsupported date unit", unit);
        }
        return amount * multiplier + time;
    },

    diff: function (max, min, unit) {
        const diff = max - min;
        let multiplier: number | undefined = undefined;
        switch (unit) {
            case "millisecond":
                multiplier = 1;
                break;
            case "second":
                multiplier = 1000;
                break;
            case "minute":
                multiplier = 60 * 1000;
                break;
            case "hour":
                multiplier = 60 * 60 * 1000;
            case "day":
                multiplier = 24 * 60 * 60 * 1000;
                break;
            case "week":
                multiplier = 7 * 24 * 60 * 60 * 1000;
                break;
            case "month":
                multiplier = 4 * 7 * 24 * 60 * 60 * 1000;
                break;
            case "quarter":
                multiplier = 3 * 4 * 7 * 24 * 60 * 60 * 1000;
                break;
            case "year":
                multiplier = 365 * 24 * 60 * 60 * 1000;
                break;
            default:
                throw new Error("Unsupported date unit", unit);
        }
        return Math.floor(diff / multiplier);
    },

    startOf: function (time, unit, weekStart) {
        const date = new Date(time);
        if (unit === "isoWeek") {
            var distance = (weekStart ?? 0) - date.getDay();
            date.setDate(date.getDate() + distance);

            // Reset time to 0 in current time zone
            date.setMilliseconds(0);
            date.setSeconds(0);
            date.setMinutes(0);
            date.setHours(0);
            return date.getTime();
        }
        switch (unit) {
            case "millisecond":
                break;
            case "second":
                date.setMilliseconds(0);
                break;
            case "minute":
                date.setMilliseconds(0);
                date.setSeconds(0);
                break;
            case "hour":
                date.setMilliseconds(0);
                date.setSeconds(0);
                date.setMinutes(0);
            case "day":
                date.setMilliseconds(0);
                date.setSeconds(0);
                date.setMinutes(0);
                date.setHours(0);
                break;
            case "week":
                date.setMilliseconds(0);
                date.setSeconds(0);
                date.setMinutes(0);
                date.setHours(0);
                date.setDate(date.getDate() - date.getDay());
                break;
            case "month":
                date.setMilliseconds(0);
                date.setSeconds(0);
                date.setMinutes(0);
                date.setHours(0);
                date.setDate(0);
                break;
            case "quarter":
                date.setMilliseconds(0);
                date.setSeconds(0);
                date.setMinutes(0);
                date.setHours(0);
                date.setDate(0);
                date.setMonth(Math.floor(date.getMonth() / 3) * 3);
                break;
            case "year":
                date.setMilliseconds(0);
                date.setSeconds(0);
                date.setMinutes(0);
                date.setHours(0);
                date.setDate(0);
                date.setMonth(0);
                break;
            default:
                throw new Error("Unsupported date unit", unit);
        }
        return date.getTime();
    },

    endOf: function (time, unit) {
        const date = new Date(time);
        if (unit === "isoWeek") {
            var distance = 7 - date.getDay();
            date.setDate(date.getDate() + distance + 1);
            // Reset time to 0 in current time zone
            date.setMilliseconds(0);
            date.setSeconds(0);
            date.setMinutes(0);
            date.setHours(0);
            return date.getTime() - 1;
        }
        switch (unit) {
            case "millisecond":
                break;
            case "second":
                date.setMilliseconds(0);
                date.setSeconds(date.getSeconds() + 1);
                break;
            case "minute":
                date.setMilliseconds(0);
                date.setSeconds(0);
                date.setMinutes(date.getMinutes() + 1);
                break;
            case "hour":
                date.setMilliseconds(0);
                date.setSeconds(0);
                date.setMinutes(0);
                date.setHours(date.getHours() + 1);
            case "day":
                date.setMilliseconds(0);
                date.setSeconds(0);
                date.setMinutes(0);
                date.setHours(0);
                date.setDate(date.getDate() + 1);
                break;
            case "week":
                date.setMilliseconds(0);
                date.setSeconds(0);
                date.setMinutes(0);
                date.setHours(0);
                date.setDate(date.getDate() - date.getDay() + 7);
                break;
            case "month":
                date.setMilliseconds(0);
                date.setSeconds(0);
                date.setMinutes(0);
                date.setHours(0);
                date.setDate(0);
                date.setMonth(date.getMonth() + 1);
                break;
            case "quarter":
                date.setMilliseconds(0);
                date.setSeconds(0);
                date.setMinutes(0);
                date.setHours(0);
                date.setDate(0);
                date.setMonth(Math.floor(date.getMonth() / 3 + 1) * 3);
                break;
            case "year":
                date.setMilliseconds(0);
                date.setSeconds(0);
                date.setMinutes(0);
                date.setHours(0);
                date.setDate(0);
                date.setMonth(0);
                date.setFullYear(date.getFullYear() + 1);
                break;
            default:
                throw new Error("Unsupported date unit", unit);
        }
        return date.getTime() - 1;
    },
};

export function addChartJsDateAdapter() {
    _adapters._date.override(adapter);
}
