/**
 * The small conversions the pages need, kept out of the templates so they can be asserted directly.
 *
 * **Every timestamp is rendered in UTC**, as in every sibling explorer: the service stamps
 * `Instant`s, and a browser-local rendering would make two operators looking at the same container
 * disagree about when it started. The relative form is the one on screen — "3h ago" is what a
 * reader of a container list actually asks — and the exact instant sits in its `title`.
 */

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** What is drawn where there is nothing to draw — one em dash, everywhere. */
export const NONE = '—';

/** How many characters of a docker id a table shows. Docker's own commands print twelve. */
const SHORT_ID_LENGTH = 12;

function parse(iso: string | null | undefined): Date | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

/** `31 Jul 2026 14:02:11Z` — an exact instant, year and seconds included. */
export function formatInstant(iso: string | null): string {
  const date = parse(iso);
  if (!date) {
    return NONE;
  }
  return (
    `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}Z`
  );
}

/**
 * `3h ago`, `2m ago`, `just now` — how long ago something happened, against a clock the caller
 * passes in.
 *
 * A container list's question is "what changed recently", and a UTC timestamp answers it only after
 * the reader has done a subtraction in their head. The exact instant is never lost: every place
 * this is drawn carries `formatInstant` in the element's `title`.
 *
 * The clock is an argument rather than `Date.now()` so a spec asserts an exact phrase, and so a
 * page that already ticks a signal redraws these without a second timer.
 */
export function formatRelative(iso: string | null, nowMs: number): string {
  const date = parse(iso);
  if (!date) {
    return NONE;
  }
  const seconds = Math.round((nowMs - date.getTime()) / 1000);
  if (seconds < 45) {
    return 'just now';
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.round(hours / 24)}d ago`;
}

/**
 * `15.6 GB`, `512 MB`, `0 B` — a byte count a person can read.
 *
 * **Decimal units, not binary**, because that is what docker prints: `docker info` reports
 * `MemTotal` in bytes and `docker system df` renders it as GB, and a page that disagreed with the
 * command line by 7% would have an operator checking which of the two is lying.
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) {
    return NONE;
  }
  const units = ['B', 'kB', 'MB', 'GB', 'TB', 'PB'] as const;
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unit]}`;
}

/**
 * The first twelve characters of a docker id — what every `docker` command prints, and what an
 * operator recognises.
 *
 * The full id stays in the row's `title` and in the URL: it is the identity, and a page that only
 * ever showed the short form would leave a reader unable to paste it into a command.
 */
export function shortId(id: string | null | undefined): string {
  if (!id) {
    return NONE;
  }
  return id.length > SHORT_ID_LENGTH ? id.slice(0, SHORT_ID_LENGTH) : id;
}

/** `10 nodes`, `1 node` — a count is never drawn without the noun it counts. */
export function plural(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}
