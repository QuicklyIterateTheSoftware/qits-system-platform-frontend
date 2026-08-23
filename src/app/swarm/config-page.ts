import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink, convertToParamMap } from '@angular/router';
import { SystemApi } from '../api/system-api';
import type { ConfigDetailDto } from '../api/dto';
import { Async } from '../ui/async';
import { Empty } from '../ui/empty';
import { NONE, formatInstant } from '../ui/format';
import { LOADING, loadInto, type Loadable } from '../ui/loadable';

/**
 * One config, with what is in it.
 *
 * The data arrives base64-decoded from the service and is drawn as text, unformatted and unparsed:
 * a config is whatever bytes somebody stored, and pretty-printing what looked like JSON would
 * silently change what a reader believes is mounted into a container.
 */
@Component({
  selector: 'app-config-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Async, Empty, RouterLink],
  styleUrls: ['../ui/page.css', './detail.css'],
  templateUrl: './config-page.html',
})
export class ConfigPage {
  private readonly api = inject(SystemApi);
  private readonly route = inject(ActivatedRoute);

  private readonly params = toSignal(this.route.paramMap, { initialValue: convertToParamMap({}) });

  protected readonly id = computed(() => this.params().get('id') ?? '');
  protected readonly none = NONE;
  protected readonly instant = formatInstant;

  protected readonly state = signal<Loadable<ConfigDetailDto>>(LOADING);
  protected readonly config = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.value : null;
  });

  protected readonly labels = computed(() =>
    Object.entries(this.config()?.labels ?? {}).map(([key, value]) => `${key}=${value}`),
  );

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => {
        this.state.set(LOADING);
        if (id) {
          void this.load();
        }
      });
    });
  }

  protected load(): Promise<void> {
    return loadInto(this.state, () => this.api.config(this.id()));
  }
}
