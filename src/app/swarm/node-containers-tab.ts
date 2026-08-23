import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { QitsButton } from '@qits/ui-components';
import type { ContainerLogsDto, ContainerSummaryDto, TerminalShell } from '../api/dto';
import { Async } from '../ui/async';
import { Empty } from '../ui/empty';
import { NONE, formatInstant, formatRelative, plural, shortId } from '../ui/format';
import { IDLE, LOADING, describeError, loadInto, type Loadable } from '../ui/loadable';
import { StatusBadge } from '../ui/status-badge';
import { tickingNow } from '../ui/ticker';
import { NodeResourceTab } from './node-resource-tab';

/** How many lines of a container's log the panel asks for. The service caps it too. */
export const LOG_TAIL = 200;

/**
 * Every container on this node, and the two things an operator came here to do: get a shell, and
 * read the last of a log.
 *
 * **`bash` and `sh` are two buttons rather than one with a choice.** Which shell a container has is
 * a property of its image and nothing on this page knows it: a distroless or Alpine container has
 * no bash, and finding that out by pressing a button and reading a 409 is faster than any picker.
 * The press creates a terminal and navigates to it, so the PTY outlives this page — closing the tab
 * does not kill the shell, and `DELETE` on the terminal page does.
 *
 * **Stopped containers are listed.** `all=true` is asked for on every read, because the container
 * that exited four minutes ago is usually the reason the page was opened.
 *
 * **The log is a tail, not a stream.** 200 lines answer "what did it say before it stopped"; a live
 * follow would be a second socket for a question this page is not asking.
 */
@Component({
  selector: 'app-node-containers-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Async, Empty, QitsButton, StatusBadge],
  styleUrls: ['../ui/page.css', './node-tab.css'],
  templateUrl: './node-containers-tab.html',
})
export class NodeContainersTab extends NodeResourceTab<ContainerSummaryDto> {
  private readonly router = inject(Router);

  protected readonly none = NONE;
  protected readonly short = shortId;
  private readonly now = tickingNow(30000);

  /** `<container id>:<shell>` while a terminal is being created, so only that button is busy. */
  protected readonly opening = signal('');
  /** Why a shell did not open — a stopped container, a missing bash, an unreachable daemon. */
  protected readonly execProblem = signal('');

  /** The container whose log is open, and the log itself. */
  protected readonly logsFor = signal<ContainerSummaryDto | null>(null);
  protected readonly logsState = signal<Loadable<ContainerLogsDto>>(IDLE);

  protected readonly caption = computed(() => plural(this.rows().length, 'container'));

  protected read(nodeId: string): Promise<readonly ContainerSummaryDto[]> {
    return this.api.containers(nodeId);
  }

  protected instant(iso: string | null | undefined): string {
    return formatInstant(iso ?? null);
  }

  protected ago(iso: string | null | undefined): string {
    return formatRelative(iso ?? null, this.now());
  }

  protected busy(container: ContainerSummaryDto, shell: TerminalShell): boolean {
    return this.opening() === `${container.id}:${shell}`;
  }

  /**
   * Open a shell in a container, then go to it.
   *
   * The navigation carries the node as a query parameter so the terminal page's back link knows
   * where it came from. The terminal's own id is the address; the node is only how a reader gets
   * back.
   */
  protected async exec(container: ContainerSummaryDto, shell: TerminalShell): Promise<void> {
    if (this.opening()) {
      return;
    }
    this.opening.set(`${container.id}:${shell}`);
    this.execProblem.set('');
    try {
      const terminal = await this.api.createExecTerminal(container.id, shell);
      await this.router.navigate(['/terminals', terminal.id], {
        queryParams: { node: this.nodeId() },
      });
    } catch (error) {
      this.execProblem.set(
        `Could not open ${shell} in ${container.name} — ${describeError(error)}.`,
      );
    } finally {
      this.opening.set('');
    }
  }

  /** Show the tail of a container's log, or close the panel if it is already this container's. */
  protected async toggleLogs(container: ContainerSummaryDto): Promise<void> {
    if (this.logsFor()?.id === container.id) {
      this.closeLogs();
      return;
    }
    this.logsFor.set(container);
    this.logsState.set(LOADING);
    await this.loadLogs();
  }

  protected async loadLogs(): Promise<void> {
    const container = this.logsFor();
    if (!container) {
      return;
    }
    await loadInto(this.logsState, () =>
      this.api.containerLogs(this.nodeId(), container.id, LOG_TAIL),
    );
  }

  protected closeLogs(): void {
    this.logsFor.set(null);
    this.logsState.set(IDLE);
  }

  /** The log text, or nothing — a container that has written nothing is not a failure. */
  protected readonly logs = computed(() => {
    const state = this.logsState();
    return state.kind === 'ready' ? state.value : null;
  });

  protected readonly tail = LOG_TAIL;
}
