import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SystemApi } from '../api/system-api';
import type { ConfigSummaryDto } from '../api/dto';
import { Async } from '../ui/async';
import { Empty } from '../ui/empty';
import { NONE, formatInstant, plural, shortId } from '../ui/format';
import { LOADING, loadInto, type Loadable } from '../ui/loadable';

/** Every swarm config. Follow a name to read what is in it. */
@Component({
  selector: 'app-configs-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Async, Empty, RouterLink],
  styleUrls: ['../ui/page.css'],
  templateUrl: './configs-page.html',
})
export class ConfigsPage {
  private readonly api = inject(SystemApi);

  protected readonly none = NONE;
  protected readonly short = shortId;
  protected readonly instant = formatInstant;

  protected readonly state = signal<Loadable<readonly ConfigSummaryDto[]>>(LOADING);
  protected readonly configs = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.value : [];
  });
  protected readonly caption = computed(() => plural(this.configs().length, 'config'));

  constructor() {
    void this.load();
  }

  protected load(): Promise<void> {
    return loadInto(this.state, () => this.api.configs());
  }

  protected labelCount(config: ConfigSummaryDto): number {
    return Object.keys(config.labels ?? {}).length;
  }
}
