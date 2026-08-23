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
import type { ServiceDetailDto } from '../api/dto';
import { Async } from '../ui/async';
import { Empty } from '../ui/empty';
import { NONE, formatInstant, formatRelative, plural, shortId } from '../ui/format';
import { LOADING, loadInto, type Loadable } from '../ui/loadable';
import { StatusBadge } from '../ui/status-badge';
import { tickingNow } from '../ui/ticker';

/**
 * One service: its spec, and every task swarm has placed for it.
 *
 * **The task list is the page.** A service that says `0/1` says nothing about why, and the answer is
 * always in a task: rejected on this node, failed with a message, or shut down because a newer one
 * replaced it. Shut-down tasks are kept in the list for that reason — they are the history of a
 * rollout, and hiding them would leave a reader with a single failing row and no story.
 */
@Component({
  selector: 'app-service-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Async, Empty, RouterLink, StatusBadge],
  styleUrls: ['../ui/page.css', './detail.css'],
  templateUrl: './service-page.html',
})
export class ServicePage {
  private readonly api = inject(SystemApi);
  private readonly route = inject(ActivatedRoute);
  private readonly now = tickingNow(30000);

  private readonly params = toSignal(this.route.paramMap, { initialValue: convertToParamMap({}) });

  protected readonly id = computed(() => this.params().get('id') ?? '');
  protected readonly none = NONE;
  protected readonly short = shortId;

  protected readonly state = signal<Loadable<ServiceDetailDto>>(LOADING);
  protected readonly service = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.value : null;
  });
  protected readonly tasks = computed(() => this.service()?.tasks ?? []);
  protected readonly caption = computed(() => plural(this.tasks().length, 'task'));

  protected readonly facts = computed(() => {
    const service = this.service();
    if (!service) {
      return [];
    }
    return [
      { label: 'Mode', value: service.mode },
      { label: 'Replicas', value: service.replicas },
      { label: 'Image', value: service.image },
      { label: 'Ports', value: service.ports || NONE },
      { label: 'Created', value: formatInstant(service.createdAt ?? null) },
      { label: 'Updated', value: formatInstant(service.updatedAt ?? null) },
    ];
  });

  protected readonly labels = computed(() =>
    Object.entries(this.service()?.labels ?? {}).map(([key, value]) => `${key}=${value}`),
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
    return loadInto(this.state, () => this.api.service(this.id()));
  }

  protected instant(iso: string | null | undefined): string {
    return formatInstant(iso ?? null);
  }

  protected ago(iso: string | null | undefined): string {
    return formatRelative(iso ?? null, this.now());
  }
}
