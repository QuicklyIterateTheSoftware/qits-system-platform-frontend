import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SystemApi } from '../api/system-api';
import type { NodeSummaryDto } from '../api/dto';
import { Async } from '../ui/async';
import { Empty } from '../ui/empty';
import { NONE, plural, shortId } from '../ui/format';
import { LOADING, loadInto, type Loadable } from '../ui/loadable';
import { StatusBadge } from '../ui/status-badge';

/**
 * Every node in the swarm.
 *
 * This read is cluster-wide — the manager answers it — which makes this the one page that sees
 * machines this service cannot otherwise touch. Following a foreign node's link is still worth
 * doing: its swarm-level facts are here, and its resource tabs say plainly that v1 does not reach
 * them.
 */
@Component({
  selector: 'app-nodes-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Async, Empty, RouterLink, StatusBadge],
  styleUrls: ['../ui/page.css'],
  templateUrl: './nodes-page.html',
})
export class NodesPage {
  private readonly api = inject(SystemApi);

  protected readonly none = NONE;
  protected readonly short = shortId;

  protected readonly state = signal<Loadable<readonly NodeSummaryDto[]>>(LOADING);
  protected readonly nodes = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.value : [];
  });
  protected readonly caption = computed(() => plural(this.nodes().length, 'node'));

  constructor() {
    void this.load();
  }

  protected load(): Promise<void> {
    return loadInto(this.state, () => this.api.nodes());
  }
}
