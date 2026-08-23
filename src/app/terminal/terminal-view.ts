import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { FitAddon } from '@xterm/addon-fit';
import type { IDisposable, Terminal } from '@xterm/xterm';
import type { TerminalFrames } from './terminal-socket';

export interface TerminalSize {
  readonly cols: number;
  readonly rows: number;
}

/**
 * A real xterm.js terminal over the service's raw PTY frame stream.
 *
 * Copied from qits-spa-workspaces. Two things about it are load-bearing rather than stylistic:
 *
 * **xterm.js is imported dynamically**, so the 300 kB of terminal emulator is a chunk the swarm
 * tables never download, and so a renderer without `matchMedia` — jsdom in a spec — keeps working:
 * the import is skipped and the raw frames are painted into a `<pre>` instead. That fallback is
 * what makes this component testable at all.
 *
 * **It fills its parent.** These pages give the terminal the whole page below the header, and a
 * fixed height here would leave a band of dead grey under a glances display that wanted the room.
 * The `ResizeObserver` refits on every change, and each refit tells the PTY its new size.
 */
@Component({
  selector: 'app-terminal-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #host class="terminal-host" [attr.aria-label]="label()">
      @if (!ready()) {
        <pre class="loading-screen" role="log">{{ pendingText() }}</pre>
      }
    </div>
    <p class="hint">{{ hint() }}</p>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
      height: 100%;
    }
    .terminal-host {
      box-sizing: border-box;
      flex: 1 1 auto;
      min-height: 12rem;
      overflow: hidden;
      padding: 0.5rem;
      border: 1px solid #1f2937;
      border-radius: 0.375rem;
      background: #111827;
    }
    .terminal-host:focus-within {
      outline: 2px solid #93c5fd;
      outline-offset: -2px;
    }
    .loading-screen {
      margin: 0;
      color: #e5e7eb;
      font:
        0.8rem/1.35 ui-monospace,
        SFMono-Regular,
        Menlo,
        monospace;
      white-space: pre-wrap;
    }
    .hint {
      flex: 0 0 auto;
      margin: 0.35rem 0 0;
      color: #6b7280;
      font-size: 0.8rem;
    }
  `,
})
export class TerminalView {
  readonly frames = input.required<TerminalFrames>();
  readonly label = input('Terminal');
  readonly attached = input(false);
  /** What to say under the terminal when it is not attached — a page knows why better than this does. */
  readonly detachedHint = input('Not attached — this is the last frame the terminal painted.');
  readonly data = output<string>();
  readonly resized = output<TerminalSize>();

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  protected readonly ready = signal(false);
  protected readonly pendingText = computed(() => this.frames().chunks.join(''));
  protected readonly hint = computed(() =>
    this.attached()
      ? 'Click the terminal and type; paste with Ctrl+V. Input goes straight to the process.'
      : this.detachedHint(),
  );

  private terminal: Terminal | null = null;
  private fitAddon: FitAddon | null = null;
  private observer: ResizeObserver | null = null;
  private disposables: IDisposable[] = [];
  private generation = -1;
  private written = 0;
  private destroyed = false;

  constructor() {
    afterNextRender(() => void this.mount());

    effect(() => {
      const frames = this.frames();
      if (!this.ready() || !this.terminal) return;
      if (frames.generation !== this.generation) {
        this.terminal.reset();
        this.generation = frames.generation;
        this.written = 0;
      }
      for (const chunk of frames.chunks.slice(this.written)) this.terminal.write(chunk);
      this.written = frames.chunks.length;
    });

    effect(() => {
      const attached = this.attached();
      if (this.ready() && this.terminal) this.terminal.options.disableStdin = !attached;
    });

    inject(DestroyRef).onDestroy(() => this.destroy());
  }

  private async mount(): Promise<void> {
    // xterm.js requires matchMedia for DPR tracking. Keeping the raw-frame fallback visible makes
    // server-side and DOM-only test renderers useful without pretending they can emulate a terminal.
    if (!this.host().nativeElement.ownerDocument.defaultView?.matchMedia) return;
    const [{ Terminal }, { FitAddon }] = await Promise.all([
      import('@xterm/xterm'),
      import('@xterm/addon-fit'),
    ]);
    if (this.destroyed) return;

    const terminal = new Terminal({
      allowProposedApi: false,
      convertEol: false,
      cursorBlink: true,
      disableStdin: !this.attached(),
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 13,
      screenReaderMode: true,
      scrollback: 6000,
      theme: { background: '#111827', foreground: '#e5e7eb' },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(this.host().nativeElement);
    terminal.textarea?.setAttribute('aria-label', `${this.label()} input`);
    this.disposables = [
      terminal.onData((value) => {
        if (this.attached()) this.data.emit(value);
      }),
      terminal.onResize(({ cols, rows }) => this.resized.emit({ cols, rows })),
    ];
    this.terminal = terminal;
    this.fitAddon = fitAddon;

    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(() => this.fit());
      this.observer.observe(this.host().nativeElement);
    }
    this.fit();
    this.ready.set(true);
    terminal.focus();
  }

  private fit(): void {
    try {
      this.fitAddon?.fit();
    } catch {
      // A hidden tab has no measurable cell geometry. Its ResizeObserver retries when visible.
    }
  }

  private destroy(): void {
    this.destroyed = true;
    this.observer?.disconnect();
    this.disposables.forEach((disposable) => disposable.dispose());
    this.terminal?.dispose();
    this.terminal = null;
    this.fitAddon = null;
  }
}
