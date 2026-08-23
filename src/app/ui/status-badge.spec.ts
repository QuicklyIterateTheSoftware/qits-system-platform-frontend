import { toneOf } from './status-tone';

/**
 * The status vocabulary, in the two places it would go wrong unnoticed.
 *
 * **Docker spells the same idea in two cases.** `docker node ls` answers `Ready`, `docker ps`
 * answers `running`, and a task's desired state is `Running`. A case-sensitive map would leave one
 * of the three grey, on one page only, which nobody would report as a bug.
 *
 * **A word this build has not been taught must be grey**, never green: docker adds enum values
 * without asking, and a badge that guessed `success` would tell an operator a dead task is fine.
 */
describe('toneOf', () => {
  it('reads a node that is up and one that is gone as different things', () => {
    expect(toneOf('Ready')).toBe('success');
    expect(toneOf('Down')).toBe('danger');
  });

  it('reads a node an operator drained as a warning, not a failure', () => {
    expect(toneOf('Drain')).toBe('warning');
    expect(toneOf('Pause')).toBe('warning');
    expect(toneOf('Active')).toBe('success');
  });

  it('colours a container state and a task state from the same map', () => {
    expect(toneOf('running')).toBe('success');
    expect(toneOf('Running')).toBe('success');
    expect(toneOf('exited')).toBe('neutral');
    expect(toneOf('Failed')).toBe('danger');
  });

  it('leaves a word it has not been taught grey rather than guessing', () => {
    expect(toneOf('SOMETHING_NEW')).toBe('neutral');
  });

  /** One field a service has not sent yet must not throw a whole page away. */
  it('treats a missing word as grey rather than as an error', () => {
    expect(toneOf('')).toBe('neutral');
    expect(toneOf(null)).toBe('neutral');
    expect(toneOf(undefined)).toBe('neutral');
  });
});
