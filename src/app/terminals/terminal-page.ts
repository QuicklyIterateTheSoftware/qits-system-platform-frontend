import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, convertToParamMap } from '@angular/router';
import { QitsButton } from '@qits/ui-components';
import { SystemApi } from '../api/system-api';
import { WEB_SOCKET_FACTORY } from '../api/web-socket';
import type { TerminalDto } from '../api/dto';
import { Async } from '../ui/async';
import { NONE } from '../ui/format';
import { LOADING, describeError, loadInto, type Loadable } from '../ui/loadable';
import {
  EMPTY_TERMINAL_FRAMES,
  TerminalSocket,
  type TerminalLink,
} from '../terminal/terminal-socket';
import { TerminalView } from '../terminal/terminal-view';

/**
 * One terminal, addressed by its own id.
 *
 * **The PTY outlives this page.** Leaving detaches the socket and nothing else, so a reader can
 * reload, share the link, or come back after a coffee and find the same shell. `Terminate` is the
 * only thing that ends it, and it is a `DELETE` rather than a socket close for exactly that reason.
 *
 * **A clean close is the end of the story.** The service writes its yellow exit line into the
 * stream and closes with 1000; the socket does not reconnect, and this page says the terminal is no
 * longer running rather than leaving a reader typing into nothing. Every other close is a service
 * restart or a broken network, and those reconnect with a replay.
 *
 * **The back link is a query parameter, not a lookup.** The container table that opened this
 * terminal passed its node along; without it — a pasted link, a reload after a hop — the link falls
 * back to the node list, which is one click further and always right.
 */
@Component({
  selector: 'app-terminal-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Async, QitsButton, RouterLink, TerminalView],
  styleUrls: ['../ui/page.css', './terminal-page.css'],
  templateUrl: './terminal-page.html',
})
export class TerminalPage {
  private readonly api = inject(SystemApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly openSocket = inject(WEB_SOCKET_FACTORY);
  private readonly document = inject(DOCUMENT);

  private readonly params = toSignal(this.route.paramMap, { initialValue: convertToParamMap({}) });
  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: convertToParamMap({}),
  });

  protected readonly none = NONE;
  protected readonly id = computed(() => this.params().get('id') ?? '');

  /** Where the reader came from, when the page that sent them said so. */
  protected readonly backLink = computed(() => {
    const node = this.query().get('node');
    return node ? ['/swarm/nodes', node, 'containers'] : ['/swarm/nodes'];
  });
  protected readonly backLabel = computed(() =>
    this.query().get('node') ? 'Back to the containers' : 'Back to the nodes',
  );

  protected readonly state = signal<Loadable<TerminalDto>>(LOADING);
  protected readonly terminal = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.value : null;
  });

  protected readonly terminating = signal(false);
  protected readonly terminateProblem = signal('');

  private readonly socketRef = signal<TerminalSocket | null>(null);

  protected readonly frames = computed(
    () => this.socketRef()?.frames() ?? EMPTY_TERMINAL_FRAMES,
  );
  protected readonly link = computed<TerminalLink>(
    () => this.socketRef()?.status() ?? 'connecting',
  );
  protected readonly attached = computed(() => this.link() === 'open');

  /**
   * Whether the service has said this terminal is over.
   *
   * `disconnected` reaches here only from a clean server close: this page never closes the socket
   * except on its way out, when nothing is left to read the signal.
   */
  protected readonly finished = computed(() => this.link() === 'disconnected');

  /** The title line: what is running, and where. */
  protected readonly title = computed(() => {
    const terminal = this.terminal();
    if (!terminal) {
      return 'Terminal';
    }
    if (terminal.kind === 'EXEC') {
      const shell = terminal.shell ?? 'shell';
      return terminal.container ? `${shell} in ${terminal.container.name}` : shell;
    }
    return 'glances';
  });

  protected readonly detachedHint = computed(() => {
    if (this.finished()) {
      return 'This terminal is no longer running.';
    }
    return this.link() === 'lost'
      ? 'The connection is gone and the retries are spent. Reload to try again.'
      : 'Attaching…';
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => {
        this.detach();
        this.state.set(LOADING);
        if (id) {
          void this.open(id);
        }
      });
    });

    inject(DestroyRef).onDestroy(() => this.detach());
  }

  protected async open(id: string): Promise<void> {
    // The read is for the title; the socket does not wait for it. A terminal whose row this app
    // cannot read is still a terminal a reader can type into.
    void loadInto(this.state, () => this.api.terminal(id));
    const socket = new TerminalSocket(this.api.socketUrl(id), this.openSocket, this.document);
    this.socketRef.set(socket);
    socket.connect();
  }

  protected reload(): Promise<void> {
    return loadInto(this.state, () => this.api.terminal(this.id()));
  }

  /** End it, then go back where the reader came from. */
  protected async terminate(): Promise<void> {
    if (this.terminating()) {
      return;
    }
    this.terminating.set(true);
    this.terminateProblem.set('');
    try {
      await this.api.deleteTerminal(this.id());
      await this.router.navigate(this.backLink());
    } catch (error) {
      this.terminateProblem.set(describeError(error));
    } finally {
      this.terminating.set(false);
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
