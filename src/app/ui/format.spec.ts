import { NONE, formatBytes, formatInstant, formatRelative, plural, shortId } from './format';

/**
 * The conversions, in the cases that are wrong on screen rather than red in a build: a container
 * that has never started, a clock a little behind the server's, and a byte count that must agree
 * with what `docker system df` prints.
 */
describe('format', () => {
  const NOW = Date.parse('2026-08-23T12:00:00Z');

  it('renders an instant in UTC, so two operators read the same time', () => {
    expect(formatInstant('2026-08-23T09:02:11Z')).toBe('23 Aug 2026 09:02:11Z');
  });

  it('says how long ago something happened, which is the question a listing asks', () => {
    expect(formatRelative('2026-08-23T09:00:00Z', NOW)).toBe('3h ago');
    expect(formatRelative('2026-08-23T11:58:00Z', NOW)).toBe('2m ago');
  });

  /** A container that has never run is not "a long time ago" — it is nothing. */
  it('says nothing for a missing instant, and nothing for an unparseable one', () => {
    expect(formatRelative(null, NOW)).toBe(NONE);
    expect(formatInstant('not a date')).toBe(NONE);
  });

  /** Clocks disagree by seconds; an instant stamped in the near future must not read as "-1m ago". */
  it('reads a stamp from the near future as just now', () => {
    expect(formatRelative('2026-08-23T12:00:30Z', NOW)).toBe('just now');
  });

  /** Decimal units, because that is the arithmetic `docker system df` and `docker info` use. */
  it('renders bytes the way docker renders them', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(999)).toBe('999 B');
    expect(formatBytes(1500)).toBe('1.5 kB');
    expect(formatBytes(16_000_000_000)).toBe('16.0 GB');
    expect(formatBytes(null)).toBe(NONE);
  });

  it('shortens a docker id to the twelve characters the command line prints', () => {
    expect(shortId('a'.repeat(64))).toBe('aaaaaaaaaaaa');
    expect(shortId('short')).toBe('short');
    expect(shortId(null)).toBe(NONE);
  });

  it('never draws a count without the noun it counts', () => {
    expect(plural(1, 'node')).toBe('1 node');
    expect(plural(3, 'node')).toBe('3 nodes');
    expect(plural(2, 'entry', 'entries')).toBe('2 entries');
  });
});
