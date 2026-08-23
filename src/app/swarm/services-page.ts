import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SystemApi } from '../api/system-api';
import type { ServiceSummaryDto } from '../api/dto';
import { Async } from '../ui/async';
import { Empty } from '../ui/empty';
import { NONE, formatInstant, formatRelative, plural } from '../ui/format';
import { LOADING, loadInto, type Loadable } from '../ui/loadable';
import { tickingNow } from '../ui/ticker';

/**
 * Every service in the swarm.
 *
 * `replicas` is docker's own string — `3/3`, `0/1`, `global` — and is drawn as it comes. Splitting
 * it into two numbers would need an invented rendering for a global service, which has neither, and
 * would put this page's arithmetic between the reader and what `docker service ls` says.
 */
@Component({
  selector: 'app-services-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Async, Empty, RouterLink],
  styleUrls: ['../ui/page.css'],
  templateUrl: './services-page.html',
})
export class ServicesPage {
  private readonly api = inject(SystemApi);
  private readonly now = tickingNow(30000);

  protected readonly none = NONE;

  protected readonly state = signal<Loadable<readonly ServiceSummaryDto[]>>(LOADING);
  protected readonly services = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.value : [];
  });
  protected readonly caption = computed(() => plural(this.services().length, 'service'));

  constructor() {
    void this.load();
  }

  protected load(): Promise<void> {
    return loadInto(this.state, () => this.api.services());
  }

  protected instant(iso: string | null | undefined): string {
    return formatInstant(iso ?? null);
  }

  protected ago(iso: string | null | undefined): string {
    return formatRelative(iso ?? null, this.now());
  }
}
