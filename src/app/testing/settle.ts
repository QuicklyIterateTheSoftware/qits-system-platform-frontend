import type { ComponentFixture } from '@angular/core/testing';

/**
 * Wait for everything a flushed response sets in motion.
 *
 * One `whenStable()` is not enough on these pages, and the reason is structural rather than a race
 * to paper over: a read goes through `loadInto`, which awaits the call and then writes the signal,
 * so the state lands one microtask after the response — and a terminal page opens its socket one
 * hop after that again. Waiting twice is exact and instant; a timeout would be neither.
 */
export async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  await fixture.whenStable();
  await fixture.whenStable();
}
