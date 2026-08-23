import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { QitsButton } from '@qits/ui-components';
import { SystemApi } from '../api/system-api';
import { WEB_SOCKET_FACTORY } from '../api/web-socket';
import type { OverviewDto, TerminalDto } from '../api/dto';
import { Async } from '../ui/async';
import { NONE, formatBytes, plural } from '../ui/format';
import { LOADING, describeError, loadInto, type Loadable } from '../ui/loadable';
import {
  EMPTY_TERMINAL_FRAMES,
  TerminalSocket,
  type TerminalLink,
} from '../terminal/terminal-socket';
import { TerminalView } from '../terminal/terminal-view';

/**
 * The front door: what this machine is doing, right now, in a live `glances`.
 *
 * **The glances session is shared, and this page never deletes it on the way out.** `POST /terminals
 * {kind:"GLANCES"}` is find-or-create — a second operator opening this page is handed the first
 * one's session, and 200 instead of 201 is how the service says so. Leaving therefore only detaches
 * the socket; deleting would blank the screen of everybody else watching.
 *
 * **Detaching is still what stops it.** The service ends a glances session a few seconds after its
 * LAST viewer leaves, so nothing keeps running once the page is closed everywhere — and the few
 * seconds are what carry the session across a reload. `Stop glances` is the button that ends it at
 * once, for everyone, and it is deliberate rather than incidental.
 *
 * **The facts above the terminal come from a separate read**, because they are the answers glances
 * does not give: which host this is, which docker, and whether the swarm has one node or five. They
 * load independently, so a failed `docker info` leaves the terminal running and says what failed.
 */
@Component({
  selector: 'app-overview-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Async, QitsButton, TerminalView],
  styleUrls: ['../ui/page.css', './overview-page.css'],
  templateUrl: './overview-page.html',
})
export class OverviewPage {
  private readonly api = inject(SystemApi);
  private readonly openSocket = inject(WEB_SOCKET_FACTORY);
  private readonly document = inject(DOCUMENT);

  protected readonly none = NONE;

  protected readonly overviewState = signal<Loadable<OverviewDto>>(LOADING);
  protected readonly sessionState = signal<Loadable<TerminalDto>>(LOADING);
  /** Set by `Stop glances`, and by nothing else: the terminal ended because somebody ended it. */
  protected readonly stopped = signal(false);
  protected readonly stopping = signal(false);
  protected readonly stopProblem = signal('');

  private readonly socketRef = signal<TerminalSocket | null>(null);

  protected readonly frames = computed(() => this.socketRef()?.frames() ?? EMPTY_TERMINAL_FRAMES);
  protected readonly link = computed<TerminalLink>(
    () => this.socketRef()?.status() ?? 'connecting',
  );
  protected readonly attached = computed(() => this.link() === 'open');

  /** The host facts, as label/value pairs, in the order a reader asks for them. */
  protected readonly facts = computed(() => {
    const state = this.overviewState();
    if (state.kind !== 'ready') {
      return [];
    }
    const { host, swarm } = state.value;
    return [
      { label: 'Host', value: host.hostname },
      { label: 'OS', value: host.os },
      { label: 'CPUs', value: `${host.cpus}` },
      { label: 'Memory', value: formatBytes(host.memoryBytes) },
      { label: 'Docker', value: host.dockerVersion },
      { label: 'Swarm', value: `${swarm.state} · ${plural(swarm.nodes, 'node')}` },
    ];
  });

  /** What the disk is holding, when the service could read it. */
  protected readonly usage = computed(() => {
    const state = this.overviewState();
    const usage = state.kind === 'ready' ? state.value.usage : null;
    if (!usage) {
      return null;
    }
    return (
      `Images ${formatBytes(usage.imagesBytes)} · containers ${formatBytes(usage.containersBytes)} · ` +
      `volumes ${formatBytes(usage.volumesBytes)} · build cache ${formatBytes(usage.buildCacheBytes)}`
    );
  });

  /** What to say under a terminal that is not taking input. */
  protected readonly detachedHint = computed(() => {
    if (this.stopped()) {
      return 'Glances is stopped. Start it again to watch this host.';
    }
    switch (this.link()) {
      case 'lost':
        return 'The connection is gone and the retries are spent. Reload to try again.';
      case 'disconnected':
        return 'This glances session has ended. Start it again to watch this host.';
      default:
        return 'Attaching to glances…';
    }
  });

  constructor() {
    void loadInto(this.overviewState, () => this.api.overview());
    void this.start();
    // Detach, never delete: the session is shared, and somebody else may be watching it. If nobody
    // is, the service ends it a few seconds later on its own.
    inject(DestroyRef).onDestroy(() => this.detach());
  }

  protected loadOverview(): Promise<void> {
    return loadInto(this.overviewState, () => this.api.overview());
  }

  /** Find or create the glances session, then attach to it. */
  protected async start(): Promise<void> {
    this.stopped.set(false);
    this.stopProblem.set('');
    this.detach();
    await loadInto(this.sessionState, () => this.api.createGlancesTerminal());
    const state = this.sessionState();
    if (state.kind !== 'ready') {
      return;
    }
    const socket = new TerminalSocket(
      this.api.socketUrl(state.value.id),
      this.openSocket,
      this.document,
    );
    this.socketRef.set(socket);
    socket.connect();
  }

  /**
   * End the shared session.
   *
   * The socket is not closed here: the service terminates the PTY, writes its exit line and closes
   * with 1000, which is the same ending every other operator's page sees. Closing first would hide
   * that from this one reader alone.
   */
  protected async stop(): Promise<void> {
    const state = this.sessionState();
    if (state.kind !== 'ready' || this.stopping()) {
      return;
    }
    this.stopping.set(true);
    this.stopProblem.set('');
    try {
      await this.api.deleteTerminal(state.value.id);
      this.stopped.set(true);
    } catch (error) {
      this.stopProblem.set(describeError(error));
    } finally {
      this.stopping.set(false);
    }
  }

  protected send(data: string): void {
    this.socketRef()?.send(data);
  }

  protected resize(size: { cols: number; rows: number }): void {
    this.socketRef()?.resize(size.cols, size.rows);
  }

  private detach(): void {
    this.socketRef()?.close();
    this.socketRef.set(null);
  }
}
