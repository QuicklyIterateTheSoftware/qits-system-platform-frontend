import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { SystemApi } from '../api/system-api';
import type { SecretSummaryDto } from '../api/dto';
import { Async } from '../ui/async';
import { Empty } from '../ui/empty';
import { NONE, formatInstant, plural, shortId } from '../ui/format';
import { LOADING, loadInto, type Loadable } from '../ui/loadable';

/**
 * Every swarm secret, by name.
 *
 * **There is no value here and there never will be.** Swarm hands a secret's bytes to a container
 * and to nothing else — not to `docker secret inspect`, not to this service. What a reader gets is
 * the existence, the age and the labels, which is enough to answer "is the secret the deployer
 * expects actually created". A page that promised more would be promising something docker refuses.
 */
@Component({
  selector: 'app-secrets-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Async, Empty],
  styleUrls: ['../ui/page.css'],
  templateUrl: './secrets-page.html',
})
export class SecretsPage {
  private readonly api = inject(SystemApi);

  protected readonly none = NONE;
  protected readonly short = shortId;
  protected readonly instant = formatInstant;

  protected readonly state = signal<Loadable<readonly SecretSummaryDto[]>>(LOADING);
  protected readonly secrets = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.value : [];
  });
  protected readonly caption = computed(() => plural(this.secrets().length, 'secret'));

  constructor() {
    void this.load();
  }

  protected load(): Promise<void> {
    return loadInto(this.state, () => this.api.secrets());
  }

  protected labelsOf(secret: SecretSummaryDto): string {
    const labels = Object.entries(secret.labels ?? {});
    return labels.length === 0 ? NONE : labels.map(([key, value]) => `${key}=${value}`).join(' ');
  }
}
